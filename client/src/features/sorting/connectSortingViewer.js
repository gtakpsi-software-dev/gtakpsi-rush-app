import { handleSortingViewerMessage } from "./handleSortingViewerMessage.js";
import { connectSortingSocket } from "./connectSortingSocket.js";

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
        onMessage: (msg) => handleSortingViewerMessage(msg, {
            ghostTimestampsRef, fetchDataRef, setViewerCount, setGhostCards,
            showRusheeNames,
        }),
        resetSession: () => setGhostCards({}),
        createWebSocket,
        scheduleReconnect,
        log,
        logError,
    });
}
