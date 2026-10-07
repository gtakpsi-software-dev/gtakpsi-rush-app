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
        setIsConnected(true);

        socketRef.current.emit('join-room', {
            roomId,
            userId: currentUser.id,
            userName: `${currentUser.firstName} ${currentUser.lastName}`,
        });
    });

    socket.on('disconnect', () => {
        setIsConnected(false);

        reconnectTimeoutRef.current = setTimer(() => {
            // A connected replacement socket makes the scheduled retry unnecessary.
            if (!socketRef.current?.connected) {
                reconnect();
            }
        }, 3000);
    });

    socket.on('connect_error', () => {
        setIsConnected(false);
    });
}
