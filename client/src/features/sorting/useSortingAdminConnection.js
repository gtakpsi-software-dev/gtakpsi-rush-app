import { useEffect } from "react";
import { realtimeBaseUrls } from "../../config/realtimeBaseUrls";
import { connectSortingAdmin } from "./connectSortingAdmin";
import { cleanupStaleSortingGhosts } from "./cleanupStaleSortingGhosts";
import { startSortingConnectionLifecycle } from "./startSortingConnectionLifecycle";

// Manage a mount-long admin sorting connection and stale ghost cleanup.
export function useSortingAdminConnection({
    auth,
    wsRef,
    draggingRef,
    ghostTimestampsRef,
    fetchDataRef,
    setWsConnected,
    setViewerCount,
    setGhostCards,
    setLockedCards,
    getCancelDragState,
}) {
    useEffect(() => {
        // Start the socket lifecycle and return its cleanup.
        return startSortingConnectionLifecycle({
            wsRef,
            // Connect the admin socket with the page’s drag and lock handlers.
            connect: () => connectSortingAdmin({
                url: `${realtimeBaseUrls.sorting}/ws`,
                wsRef,
                // Read the current Firebase user for the sorting join message.
                getCurrentUser: () => auth.currentUser,
                draggingRef,
                ghostTimestampsRef,
                fetchDataRef,
                setWsConnected,
                setViewerCount,
                setGhostCards,
                setLockedCards,
                // Resolve after render because the page creates drag handlers below this hook.
                cancelDragState: getCancelDragState(),
            }),
            // Remove stale admin drag ghosts and locks.
            sweep: () => cleanupStaleSortingGhosts({
                ghostTimestampsRef, setGhostCards, setLockedCards,
            }),
            // Schedule recurring stale-drag cleanup.
            schedule: (callback, delay) => setInterval(callback, delay),
            // Cancel recurring stale-drag cleanup.
            clear: (interval) => clearInterval(interval),
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- One connection per mount preserves the current session lifecycle.
    }, []);
}
