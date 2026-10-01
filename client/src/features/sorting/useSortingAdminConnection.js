import { useEffect } from "react";
import { realtimeBaseUrls } from "../../config/realtimeBaseUrls";
import { connectSortingAdmin } from "./connectSortingAdmin";
import { cleanupStaleSortingGhosts } from "./cleanupStaleSortingGhosts";
import { startSortingConnectionLifecycle } from "./startSortingConnectionLifecycle";

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
        return startSortingConnectionLifecycle({
            wsRef,
            connect: () => connectSortingAdmin({
                url: `${realtimeBaseUrls.sorting}/ws`,
                wsRef,
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
            sweep: () => cleanupStaleSortingGhosts({
                ghostTimestampsRef, setGhostCards, setLockedCards,
            }),
            schedule: (callback, delay) => setInterval(callback, delay),
            clear: (interval) => clearInterval(interval),
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- One connection per mount preserves the current session lifecycle.
    }, []);
}
