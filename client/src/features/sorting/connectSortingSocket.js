// Connect a sorting socket, identify the viewer, and register message and retry handlers.
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
    createWebSocket = /* Create a browser WebSocket for the sorting endpoint. */ (socketUrl) => new WebSocket(socketUrl),
    scheduleReconnect = /* Schedule a sorting reconnection after the requested delay. */ (callback, delay) => setTimeout(callback, delay),
    log = /* Log sorting connection lifecycle messages. */ (...args) => console.log(...args),
    logError = /* Log sorting socket or message-processing errors. */ (...args) => console.error(...args),
}) {
    // Create a socket and install its lifecycle callbacks.
    const connectWs = () => {
        const ws = createWebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            // Mark the socket connected and send the user’s sorting-session identity.
            log(connectedMessage);
            setWsConnected(true);
            const user = getCurrentUser();
            const name = user?.displayName || user?.email?.split("@")[0] || fallbackName;
            ws.send(JSON.stringify({ type: "join", is_admin: isAdmin, name }));
        };

        ws.onmessage = (event) => {
            // Parse and dispatch a sorting message, logging parsing or handler failures.
            try {
                const msg = JSON.parse(event.data);
                onMessage(msg);
            } catch (error) {
                logError("Failed to parse WS message", error);
            }
        };

        ws.onclose = () => {
            // Clear session state and schedule reconnection after disconnection.
            log("Disconnected from sorting broadcaster");
            setWsConnected(false);
            resetSession();
            // Preserve reconnect scheduling when cleanup closes the socket.
            scheduleReconnect(connectWs, 3000);
        };

        ws.onerror = (error) => {
            // Log a socket error and close the failed connection.
            logError("WebSocket error", error);
            ws.close();
        };
    };

    connectWs();
}
