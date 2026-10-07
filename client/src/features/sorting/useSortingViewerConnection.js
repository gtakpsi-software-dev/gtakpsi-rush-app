import { useEffect } from "react";
import { realtimeBaseUrls } from "../../config/realtimeBaseUrls";
import { connectSortingViewer } from "./connectSortingViewer";
import { cleanupStaleSortingGhosts } from "./cleanupStaleSortingGhosts";
import { startSortingConnectionLifecycle } from "./startSortingConnectionLifecycle";

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
        return startSortingConnectionLifecycle({
            wsRef,
            connect: () => connectSortingViewer({
                url: `${realtimeBaseUrls.sorting}/ws`,
                wsRef,
                getCurrentUser: () => auth.currentUser,
                ghostTimestampsRef,
                fetchDataRef,
                setWsConnected,
                setViewerCount,
                setGhostCards,
                showRusheeNames,
            }),
            sweep: () => cleanupStaleSortingGhosts({ ghostTimestampsRef, setGhostCards }),
            schedule: (callback, delay) => setInterval(callback, delay),
            clear: (interval) => clearInterval(interval),
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- One connection per mount preserves the current session lifecycle.
    }, []);
}
