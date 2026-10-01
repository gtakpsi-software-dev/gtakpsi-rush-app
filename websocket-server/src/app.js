const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { registerRoutes } = require('./routes');
const { scheduleRoomCleanup } = require('./roomRetention');
const { registerMembershipHandlers } = require('./handlers/membership');
const { registerLegacyTextOperationHandlers } = require('./handlers/legacyTextOperations');
const { registerUpdateHandlers } = require('./handlers/updates');
const { registerPresenceHandlers } = require('./handlers/presence');

// Each instance owns its room state. Tests can isolate timers without changing
// production cleanup delays or the HTTP and Socket.IO contracts.
function createCollaborationServer({ timers = globalThis } = {}) {
    const app = express();
    const server = http.createServer(app);
    app.use(cors());
    app.use(express.json());

    const io = socketIo(server, {
        cors: { origin: '*', methods: ['GET', 'POST'] },
    });
    const rooms = new Map();
    const membershipsBySocket = new Map();

    registerRoutes(app, rooms);
    io.on('connection', (socket) => {
        registerMembershipHandlers(io, socket, rooms, membershipsBySocket, timers);
        registerLegacyTextOperationHandlers(socket, rooms, membershipsBySocket);
        registerUpdateHandlers(socket, rooms, membershipsBySocket);
        registerPresenceHandlers(socket, rooms, membershipsBySocket);
    });
    scheduleRoomCleanup(rooms, timers);

    return { app, server, io };
}

module.exports = { createCollaborationServer };
