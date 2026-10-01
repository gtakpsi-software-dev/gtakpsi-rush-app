function joinedRoom(socket, rooms, userSockets) {
    // INVARIANT: unjoined or stale sockets cannot mutate or broadcast room state.
    const userData = userSockets.get(socket.id);
    if (!userData) return null;

    const { roomId, userInfo } = userData;
    const room = rooms.get(roomId);
    if (!room) return null;

    return { roomId, userInfo, room };
}

module.exports = { joinedRoom };
