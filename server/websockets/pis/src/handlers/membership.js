const { createRoom, snapshotDocument } = require('../rooms');
const { scheduleEmptyRoomRemoval } = require('../roomRetention');
const { joinedRoom } = require('./joinedRoom');

function joinRoom(io, socket, rooms, membershipsBySocket, { roomId, userId, userName }) {
    socket.join(roomId);

    const userInfo = {
        id: userId,
        name: userName,
        socketId: socket.id,
        connectedAt: new Date().toISOString()
    };
    // The latest join owns disconnect cleanup; earlier room presence stays as-is.
    membershipsBySocket.set(socket.id, { roomId, userInfo });

    if (!rooms.has(roomId)) {
        rooms.set(roomId, createRoom());
    }

    const room = rooms.get(roomId);
    room.users.set(userId, userInfo);
    room.lastActivity = new Date().toISOString();

    socket.emit('document-state', snapshotDocument(room));

    const userList = Array.from(room.users.values());
    io.to(roomId).emit('users-updated', userList);
}

function disconnectRoom(socket, rooms, membershipsBySocket, timers) {
    const membership = membershipsBySocket.get(socket.id);
    if (!membership) {
        return;
    }

    const { roomId, userInfo } = membership;
    const room = rooms.get(roomId);

    if (room) {
        room.users.delete(userInfo.id);
        room.lastActivity = new Date().toISOString();

        const userList = Array.from(room.users.values());
        socket.to(roomId).emit('users-updated', userList);

        // Preserve a disconnected room briefly so reconnecting editors recover its text.
        if (room.users.size === 0) {
            scheduleEmptyRoomRemoval(rooms, roomId, timers);
        }
    }

    membershipsBySocket.delete(socket.id);
}

function registerMembershipHandlers(io, socket, rooms, membershipsBySocket, timers) {
    socket.on('join-room', (membership) => {
        joinRoom(io, socket, rooms, membershipsBySocket, membership);
    });

    socket.on('request-document-state', () => {
        const joined = joinedRoom(socket, rooms, membershipsBySocket);
        if (!joined) return;
        const { room } = joined;

        socket.emit('document-state', snapshotDocument(room));
    });

    socket.on('disconnect', () => {
        disconnectRoom(socket, rooms, membershipsBySocket, timers);
    });
}

module.exports = { registerMembershipHandlers };
