export function cleanupStaleSortingGhosts({
    ghostTimestampsRef, setGhostCards, setLockedCards,
    now = Date.now,
    log = (...values) => console.log(...values),
}) {
    const currentTime = now();
    const STALE_THRESHOLD = 30000;
    const staleIds = Object.entries(ghostTimestampsRef.current)
        .filter(([, timestamp]) => currentTime - timestamp > STALE_THRESHOLD)
        .map(([id]) => id);

    if (staleIds.length > 0) {
        // A missed drag_end must not leave a card ghosted or locked indefinitely.
        log("Cleaning up stale ghosts:", staleIds);
        staleIds.forEach((id) => {
            delete ghostTimestampsRef.current[id];
        });
        setGhostCards((prev) => {
            const next = { ...prev };
            staleIds.forEach((id) => delete next[id]);
            return next;
        });
        // Viewer boards have ghosts but no lock state; admin boards clear both.
        if (setLockedCards) {
            setLockedCards((prev) => {
                const next = { ...prev };
                staleIds.forEach((id) => delete next[id]);
                return next;
            });
        }
    }
}
