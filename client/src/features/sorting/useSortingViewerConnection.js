import { useEffect } from "react";
import { realtimeBaseUrls } from "../../config/realtimeBaseUrls";
import { connectSortingViewer } from "./connectSortingViewer";
import { cleanupStaleSortingGhosts } from "./cleanupStaleSortingGhosts";

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
    // Keep one session per page mount; cleanup follows the ref after reconnects.
    useEffect(() => {
        connectSortingViewer({
            url: `${realtimeBaseUrls.sorting}/ws`,
            wsRef,
            getCurrentUser: () => auth.currentUser,
            ghostTimestampsRef,
            fetchDataRef,
            setWsConnected,
            setViewerCount,
            setGhostCards,
            showRusheeNames,
        });

        const staleCleanupInterval = setInterval(() => {
            cleanupStaleSortingGhosts({ ghostTimestampsRef, setGhostCards });
        }, 5000);

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
            clearInterval(staleCleanupInterval);
        };
    }, []);
}
