import { handleSortingViewerMessage } from "./handleSortingViewerMessage.js";

export function connectSortingViewer({
    url,
    wsRef,
    getCurrentUser,
    ghostTimestampsRef,
    fetchDataRef,
    setWsConnected,
    setViewerCount,
    setGhostCards,
    showRusheeNames,
    createWebSocket = (socketUrl) => new WebSocket(socketUrl),
    scheduleReconnect = (callback, delay) => setTimeout(callback, delay),
    log = (...args) => console.log(...args),
    logError = (...args) => console.error(...args),
}) {
    const connectWs = () => {
        const ws = createWebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            log("Connected to sorting broadcaster (viewer)");
            setWsConnected(true);
            const user = getCurrentUser();
            const name = user?.displayName || user?.email?.split("@")[0] || "Viewer";
            ws.send(JSON.stringify({ type: "join", is_admin: false, name }));
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                handleSortingViewerMessage(msg, {
                    ghostTimestampsRef, fetchDataRef, setViewerCount, setGhostCards,
                    showRusheeNames,
                });
            } catch (error) {
                logError("Failed to parse WS message", error);
            }
        };

        ws.onclose = () => {
            log("Disconnected from sorting broadcaster");
            setWsConnected(false);
            setGhostCards({});
            // Preserve reconnect scheduling even when the page cleanup closes this socket.
            scheduleReconnect(connectWs, 3000);
        };

        ws.onerror = (error) => {
            logError("WebSocket error", error);
            ws.close();
        };
    };

    connectWs();
}
