// Return the socket's current membership and room, or null if either is missing.
function joinedRoom(socket, rooms, membershipsBySocket) {
    // INVARIANT: unjoined or stale sockets cannot mutate or broadcast room state.
    const membership = membershipsBySocket.get(socket.id);
    if (!membership) return null;

    const { roomId, userInfo } = membership;
    const room = rooms.get(roomId);
    if (!room) return null;

    return { roomId, userInfo, room };
}

module.exports = { joinedRoom };
