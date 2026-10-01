import { handleAdminSortingMessage } from "./handleAdminSortingMessage.js";
import { connectSortingSocket } from "./connectSortingSocket.js";

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
        onMessage: (msg) => handleAdminSortingMessage(msg, {
            draggingRef, ghostTimestampsRef, fetchDataRef,
            setViewerCount, setGhostCards, setLockedCards, cancelDragState,
        }),
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
