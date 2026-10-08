import { useEffect } from "react";
import { realtimeBaseUrls } from "../../config/realtimeBaseUrls";
import { connectSortingViewer } from "./connectSortingViewer";
import { cleanupStaleSortingGhosts } from "./cleanupStaleSortingGhosts";
import { startSortingConnectionLifecycle } from "./startSortingConnectionLifecycle";

// Manage a mount-long viewer sorting connection and stale ghost cleanup.
export function useSortingViewerConnection({
    auth,
    wsRef,
    ghostTimestampsRef,
    fetchDataRef,
    setWsConnected,
    setViewerCount,
    setGhostCards,
    showRusheeNames,
}) {
    useEffect(() => {
        // Start the socket lifecycle and return its cleanup.
        return startSortingConnectionLifecycle({
            wsRef,
            // Connect a read-only socket with the selected name-visibility policy.
            connect: () => connectSortingViewer({
                url: `${realtimeBaseUrls.sorting}/ws`,
                wsRef,
                // Read the current Firebase user for the sorting join message.
                getCurrentUser: () => auth.currentUser,
                ghostTimestampsRef,
                fetchDataRef,
                setWsConnected,
                setViewerCount,
                setGhostCards,
                showRusheeNames,
            }),
            // Remove stale viewer drag ghosts.
            sweep: () => cleanupStaleSortingGhosts({ ghostTimestampsRef, setGhostCards }),
            // Schedule recurring stale-drag cleanup.
            schedule: (callback, delay) => setInterval(callback, delay),
            // Cancel recurring stale-drag cleanup.
            clear: (interval) => clearInterval(interval),
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- One connection per mount preserves the current session lifecycle.
    }, []);
}
