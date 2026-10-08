import { handleAdminSortingMessage } from "./handleAdminSortingMessage.js";
import { connectSortingSocket } from "./connectSortingSocket.js";

// Connect an admin sorting session with drag-lock handling and session cleanup.
export function connectSortingAdmin({
    url,
    wsRef,
    getCurrentUser,
    draggingRef,
    ghostTimestampsRef,
    fetchDataRef,
    setWsConnected,
    setViewerCount,
    setGhostCards,
    setLockedCards,
    cancelDragState,
    createWebSocket,
    scheduleReconnect,
    log,
    logError,
}) {
    connectSortingSocket({
        url,
        wsRef,
        getCurrentUser,
        isAdmin: true,
        fallbackName: "Admin",
        connectedMessage: "Connected to sorting broadcaster",
        setWsConnected,
        // Dispatch a received message to admin sorting state handlers.
        onMessage: (msg) => handleAdminSortingMessage(msg, {
            draggingRef, ghostTimestampsRef, fetchDataRef,
            setViewerCount, setGhostCards, setLockedCards, cancelDragState,
        }),
        // Clear ghost cards and locks when the admin session disconnects.
        resetSession: () => {
            setGhostCards({});
            setLockedCards({});
        },
        createWebSocket,
        scheduleReconnect,
        log,
        logError,
    });
}
