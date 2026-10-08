// Remove drag ghosts and optional locks whose last update is over thirty seconds old.
export function cleanupStaleSortingGhosts({
    ghostTimestampsRef, setGhostCards, setLockedCards,
    now = Date.now,
    log = /* Log stale-ghost cleanup details. */ (...values) => console.log(...values),
}) {
    const currentTime = now();
    const STALE_THRESHOLD = 30000;
    const staleIds = Object.entries(ghostTimestampsRef.current)
        .filter(/* Find drag timestamps older than the stale threshold. */ ([, timestamp]) => currentTime - timestamp > STALE_THRESHOLD)
        .map(/* Extract the stale card ID. */ ([id]) => id);

    if (staleIds.length > 0) {
        // A missed drag_end must not leave a card ghosted or locked indefinitely.
        log("Cleaning up stale ghosts:", staleIds);
        staleIds.forEach((id) => {
            // Remove a stale drag timestamp.
            delete ghostTimestampsRef.current[id];
        });
        setGhostCards((prev) => {
            // Remove all stale ghost cards from a copied state object.
            const next = { ...prev };
            staleIds.forEach(/* Delete one stale ghost card. */ (id) => delete next[id]);
            return next;
        });
        // Viewer boards have ghosts but no lock state; admin boards clear both.
        if (setLockedCards) {
            setLockedCards((prev) => {
                // Remove all stale locks from a copied state object.
                const next = { ...prev };
                staleIds.forEach(/* Delete one stale card lock. */ (id) => delete next[id]);
                return next;
            });
        }
    }
}
