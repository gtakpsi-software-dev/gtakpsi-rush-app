import { useEffect } from "react";
import { realtimeBaseUrls } from "../../config/realtimeBaseUrls";
import { connectSortingAdmin } from "./connectSortingAdmin";
import { cleanupStaleSortingGhosts } from "./cleanupStaleSortingGhosts";

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
        connectSortingAdmin({
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
        });

        const staleCleanupInterval = setInterval(() => {
            cleanupStaleSortingGhosts({ ghostTimestampsRef, setGhostCards, setLockedCards });
        }, 5000);

        return () => {
            if (wsRef.current) {
                // eslint-disable-next-line react-hooks/exhaustive-deps -- Reconnects replace the ref; cleanup must close the latest socket.
                wsRef.current.close();
            }
            clearInterval(staleCleanupInterval);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- One connection per mount preserves the current session lifecycle.
    }, []);
}
