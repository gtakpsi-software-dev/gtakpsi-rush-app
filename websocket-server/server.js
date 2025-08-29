const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// In-memory storage for demo purposes
// In production, you'd want to use Redis or a database
const rooms = new Map();
const userSockets = new Map();

// Operational Transform utilities for conflict resolution
const transformOperation = (op1, op2) => {
    // Simple operational transformation logic
    // This handles the case where two operations happen simultaneously
    if (op1.position <= op2.position) {
        if (op1.type === 'insert') {
            return {
                ...op2,
                position: op2.position + (op1.content?.length || 0)
            };
        } else if (op1.type === 'delete') {
            return {
                ...op2,
                position: Math.max(op2.position - (op1.length || 0), op1.position)
            };
        }
    }
    return op2;
};

// Basic health check endpoint
app.get('/health', (req, res) => {
    const roomCount = rooms.size;
    const totalConnections = Array.from(rooms.values()).reduce((sum, room) => sum + room.users.size, 0);
    
    res.json({
        status: 'healthy',
        rooms: roomCount,
        connections: totalConnections,
        timestamp: new Date().toISOString()
    });
});

// Get room stats endpoint
app.get('/rooms/:roomId/stats', (req, res) => {
    const { roomId } = req.params;
    const room = rooms.get(roomId);
    
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }
    
    res.json({
        roomId,
        userCount: room.users.size,
        users: Array.from(room.users.values()).map(user => ({
            id: user.id,
            name: user.name,
            connectedAt: user.connectedAt
        })),
        operationCount: room.operations.length,
        lastActivity: room.lastActivity
    });
});

io.on('connection', (socket) => {

    socket.on('join-room', ({ roomId, userId, userName }) => {
        socket.join(roomId);
        
        // Store user information
        const userInfo = { 
            id: userId, 
            name: userName, 
            socketId: socket.id,
            connectedAt: new Date().toISOString()
        };
        userSockets.set(socket.id, { roomId, userInfo });

        // Initialize room if it doesn't exist
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                users: new Map(),
                operations: [],
                document: new Map(), // Store document state per field
                versions: new Map(), // Store per-field versions for conflict control
                lastActivity: new Date().toISOString()
            });
        }

        const room = rooms.get(roomId);
        room.users.set(userId, userInfo);
        room.lastActivity = new Date().toISOString();

        // Send current document state to the new user (include versions)
        const documentState = {};
        for (const [field, content] of room.document.entries()) {
            const version = room.versions.get(field) || 0;
            documentState[field] = { value: content, version };
        }
        socket.emit('document-state', documentState);

        // Notify all users in the room about user list update
        const userList = Array.from(room.users.values());
        io.to(roomId).emit('users-updated', userList);
    });

    socket.on('text-operation', (operation) => {
        const userData = userSockets.get(socket.id);
        if (!userData) return;

        const { roomId, userInfo } = userData;
        const room = rooms.get(roomId);
        if (!room) return;

        // Add metadata to operation
        const enhancedOperation = {
            ...operation,
            id: uuidv4(),
            userId: userInfo.id,
            userName: userInfo.name,
            timestamp: Date.now()
        };

        // Apply operational transformation against recent operations
        const recentOps = room.operations.slice(-10); // Only consider last 10 operations for performance
        let transformedOp = enhancedOperation;
        
        for (const existingOp of recentOps) {
            if (existingOp.field === transformedOp.field && 
                Math.abs(existingOp.timestamp - transformedOp.timestamp) < 1000) { // Within 1 second
                transformedOp = transformOperation(existingOp, transformedOp);
            }
        }

        // Store operation in room history
        room.operations.push(transformedOp);
        room.lastActivity = new Date().toISOString();

        // Keep only last 100 operations to prevent memory issues
        if (room.operations.length > 100) {
            room.operations = room.operations.slice(-100);
        }

        // Update document state
        const currentDoc = room.document.get(operation.field) || '';
        let newDoc = currentDoc;
        
        switch (operation.type) {
            case 'insert':
                newDoc = currentDoc.slice(0, operation.position) + 
                        (operation.content || '') + 
                        currentDoc.slice(operation.position);
                break;
            case 'delete':
                newDoc = currentDoc.slice(0, operation.position) + 
                        currentDoc.slice(operation.position + (operation.length || 0));
                break;
            case 'replace':
                newDoc = currentDoc.slice(0, operation.position) + 
                        (operation.content || '') + 
                        currentDoc.slice(operation.position + (operation.length || 0));
                break;
        }
        
        room.document.set(operation.field, newDoc);

        // Broadcast to all other users in the room
        socket.to(roomId).emit('text-operation', transformedOp);
    });

    // New full-text synchronization mode with versioning + ack/reject
    socket.on('text-update', (payload) => {
        /* payload = { field: string, value: string, userId: string, userName: string, baseVersion: number, clientUpdateId: string } */
        const userData = userSockets.get(socket.id);
        if (!userData) return;

        const { roomId } = userData;
        const room = rooms.get(roomId);
        if (!room) return;

        // Basic payload validation
        const field = payload?.field;
        const value = typeof payload?.value === 'string' ? payload.value : '';
        const baseVersion = typeof payload?.baseVersion === 'number' ? payload.baseVersion : undefined;
        const clientUpdateId = typeof payload?.clientUpdateId === 'string' ? payload.clientUpdateId : undefined;

        if (!field || baseVersion === undefined || !clientUpdateId) {
            return; // ignore malformed payloads
        }

        const currentVersion = room.versions.get(field) || 0;

        // Version mismatch → reject with server truth
        if (baseVersion !== currentVersion) {
            socket.emit('text-reject', {
                field,
                serverValue: room.document.get(field) || '',
                serverVersion: currentVersion,
                clientUpdateId,
                timestamp: Date.now(),
            });
            return;
        }

        // Apply update and increment version
        room.document.set(field, value);
        const newVersion = currentVersion + 1;
        room.versions.set(field, newVersion);
        room.lastActivity = new Date().toISOString();

        // Ack to sender
        socket.emit('text-ack', {
            field,
            version: newVersion,
            clientUpdateId,
            timestamp: Date.now(),
        });

        // Broadcast to others with the committed version
        socket.to(roomId).emit('text-update', {
            field,
            value,
            version: newVersion,
            userId: payload.userId,
            userName: payload.userName,
            timestamp: Date.now(),
        });
    });

    socket.on('cursor-position', (data) => {
        const userData = userSockets.get(socket.id);
        if (!userData) return;

        const { roomId, userInfo } = userData;
        const room = rooms.get(roomId);
        if (!room) return;
        
        room.lastActivity = new Date().toISOString();
        
        // Broadcast cursor position to other users
        socket.to(roomId).emit('cursor-position', {
            ...data,
            userId: userInfo.id,
            userName: userInfo.name,
            timestamp: Date.now()
        });
    });

    socket.on('typing-indicator', (data) => {
        const userData = userSockets.get(socket.id);
        if (!userData) return;

        const { roomId, userInfo } = userData;
        const room = rooms.get(roomId);
        if (!room) return;
        
        room.lastActivity = new Date().toISOString();
        
        // Broadcast typing indicator to other users
        socket.to(roomId).emit('typing-indicator', {
            ...data,
            userId: userInfo.id,
            userName: userInfo.name,
            timestamp: Date.now()
        });
    });

    socket.on('request-document-state', () => {
        const userData = userSockets.get(socket.id);
        if (!userData) return;

        const { roomId } = userData;
        const room = rooms.get(roomId);
        if (!room) return;

        const documentState = {};
        for (const [field, content] of room.document.entries()) {
            const version = room.versions.get(field) || 0;
            documentState[field] = { value: content, version };
        }
        socket.emit('document-state', documentState);
    });

    socket.on('disconnect', () => {
        const userData = userSockets.get(socket.id);
        if (!userData) {
            return;
        }

        const { roomId, userInfo } = userData;
        const room = rooms.get(roomId);
        
        if (room) {
            room.users.delete(userInfo.id);
            room.lastActivity = new Date().toISOString();
            
            // Notify remaining users
            const userList = Array.from(room.users.values());
            socket.to(roomId).emit('users-updated', userList);
            
            // Clean up empty rooms after 5 minutes of inactivity
            if (room.users.size === 0) {
                setTimeout(() => {
                    const currentRoom = rooms.get(roomId);
                    if (currentRoom && currentRoom.users.size === 0) {
                        rooms.delete(roomId);
                    }
                }, 5 * 60 * 1000); // 5 minutes
            }
        }

        userSockets.delete(socket.id);
    });
});

// Cleanup old rooms periodically
setInterval(() => {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    for (const [roomId, room] of rooms.entries()) {
        const lastActivity = new Date(room.lastActivity).getTime();
        if (lastActivity < oneHourAgo && room.users.size === 0) {
            rooms.delete(roomId);
        }
    }
}, 10 * 60 * 1000); // Run every 10 minutes

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 WebSocket server running on port ${PORT}`);
    console.log(`📊 Health check available at http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
}); 