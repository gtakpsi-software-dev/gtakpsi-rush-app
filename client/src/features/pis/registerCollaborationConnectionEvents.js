// Register connection status, room joining, and reconnect behavior for the PIS socket.
export function registerCollaborationConnectionEvents({
    socket,
    socketRef,
    reconnectTimeoutRef,
    roomId,
    currentUser,
    setIsConnected,
    reconnect,
    setTimer = setTimeout,
}) {
    socket.on('connect', () => {
        // Mark the connection active and join the rushee’s room with collaborator identity.
        setIsConnected(true);

        socketRef.current.emit('join-room', {
            roomId,
            userId: currentUser.id,
            userName: `${currentUser.firstName} ${currentUser.lastName}`,
        });
    });

    socket.on('disconnect', () => {
        // Mark the socket disconnected and schedule a retry.
        setIsConnected(false);

        reconnectTimeoutRef.current = setTimer(() => {
            // Reconnect only if a replacement socket has not already connected.
            // A connected replacement socket makes the scheduled retry unnecessary.
            if (!socketRef.current?.connected) {
                reconnect();
            }
        }, 3000);
    });

    socket.on('connect_error', () => {
        // Mark the collaboration connection unavailable after a connection error.
        setIsConnected(false);
    });
}
