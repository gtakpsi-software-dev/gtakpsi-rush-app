export function connectSortingSocket({
    url,
    wsRef,
    getCurrentUser,
    isAdmin,
    fallbackName,
    connectedMessage,
    setWsConnected,
    onMessage,
    resetSession,
    createWebSocket = (socketUrl) => new WebSocket(socketUrl),
    scheduleReconnect = (callback, delay) => setTimeout(callback, delay),
    log = (...args) => console.log(...args),
    logError = (...args) => console.error(...args),
}) {
    const connectWs = () => {
        const ws = createWebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            log(connectedMessage);
            setWsConnected(true);
            const user = getCurrentUser();
            const name = user?.displayName || user?.email?.split("@")[0] || fallbackName;
            ws.send(JSON.stringify({ type: "join", is_admin: isAdmin, name }));
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                onMessage(msg);
            } catch (error) {
                logError("Failed to parse WS message", error);
            }
        };

        ws.onclose = () => {
            log("Disconnected from sorting broadcaster");
            setWsConnected(false);
            resetSession();
            // Preserve reconnect scheduling when cleanup closes the socket.
            scheduleReconnect(connectWs, 3000);
        };

        ws.onerror = (error) => {
            logError("WebSocket error", error);
            ws.close();
        };
    };

    connectWs();
}
