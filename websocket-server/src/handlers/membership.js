const { snapshotDocument } = require('../rooms');
const { joinedRoom } = require('./joinedRoom');

function registerMembershipHandlers(io, socket, rooms, userSockets, timers) {
    socket.on('join-room', ({ roomId, userId, userName }) => {
        socket.join(roomId);

        const userInfo = {
            id: userId,
            name: userName,
            socketId: socket.id,
            connectedAt: new Date().toISOString()
        };
        userSockets.set(socket.id, { roomId, userInfo });

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

        socket.emit('document-state', snapshotDocument(room));

        const userList = Array.from(room.users.values());
        io.to(roomId).emit('users-updated', userList);
    });

    socket.on('request-document-state', () => {
        const joined = joinedRoom(socket, rooms, userSockets);
        if (!joined) return;
        const { room } = joined;

        socket.emit('document-state', snapshotDocument(room));
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

            const userList = Array.from(room.users.values());
            socket.to(roomId).emit('users-updated', userList);

            // Preserve a disconnected room briefly so reconnecting editors recover its text.
            if (room.users.size === 0) {
                timers.setTimeout(() => {
                    const currentRoom = rooms.get(roomId);
                    if (currentRoom && currentRoom.users.size === 0) {
                        rooms.delete(roomId);
                    }
                }, 5 * 60 * 1000);
            }
        }

        userSockets.delete(socket.id);
    });
}

module.exports = { registerMembershipHandlers };
