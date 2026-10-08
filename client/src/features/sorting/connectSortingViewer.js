import { handleSortingViewerMessage } from "./handleSortingViewerMessage.js";
import { connectSortingSocket } from "./connectSortingSocket.js";

// Connect a read-only sorting session with the configured rushee-name visibility.
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
    createWebSocket,
    scheduleReconnect,
    log,
    logError,
}) {
    connectSortingSocket({
        url,
        wsRef,
        getCurrentUser,
        isAdmin: false,
        fallbackName: "Viewer",
        connectedMessage: "Connected to sorting broadcaster (viewer)",
        setWsConnected,
        // Dispatch a received message to viewer sorting state handlers.
        onMessage: (msg) => handleSortingViewerMessage(msg, {
            ghostTimestampsRef, fetchDataRef, setViewerCount, setGhostCards,
            showRusheeNames,
        }),
        // Clear ghost cards when the viewer session disconnects.
        resetSession: () => setGhostCards({}),
        createWebSocket,
        scheduleReconnect,
        log,
        logError,
    });
}
