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
                // eslint-disable-next-line react-hooks/exhaustive-deps -- Reconnects replace the ref; cleanup must close the latest socket.
                wsRef.current.close();
            }
            clearInterval(staleCleanupInterval);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- One connection per mount preserves the current session lifecycle.
    }, []);
}
