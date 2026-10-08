// Record a remote drag’s timestamp, ghost card, and optional ownership lock.
export function showSortingGhost(msg, {
    ghostTimestampsRef, setGhostCards, setLockedCards, now, rusheeName,
}) {
    ghostTimestampsRef.current[msg.rushee_id] = now();
    setGhostCards(/* Insert or replace the ghost card from the remote drag. */ (prev) => ({
        ...prev,
        [msg.rushee_id]: {
            rusheeId: msg.rushee_id,
            rusheeName,
            x: msg.x,
            y: msg.y,
            draggerName: msg.dragger_name,
        },
    }));
    if (setLockedCards) {
        setLockedCards(/* Record the remote dragger as the card’s lock owner. */ (prev) => ({
            ...prev,
            [msg.rushee_id]: msg.dragger_name,
        }));
    }
}

// Refresh a ghost’s timestamp and move it if its start event has been received.
export function moveSortingGhost(msg, { ghostTimestampsRef, setGhostCards, now }) {
    ghostTimestampsRef.current[msg.rushee_id] = now();
    setGhostCards((prev) => {
        // Update an existing ghost’s coordinates while preserving absent-ghost state.
        // Moves can arrive before starts; keep state identity until a ghost exists.
        if (!prev[msg.rushee_id]) return prev;
        return {
            ...prev,
            [msg.rushee_id]: {
                ...prev[msg.rushee_id],
                x: msg.x,
                y: msg.y,
            },
        };
    });
}

// Remove a card’s drag timestamp, ghost, and optional ownership lock.
export function clearSortingGhost(rusheeId, {
    ghostTimestampsRef, setGhostCards, setLockedCards,
}) {
    delete ghostTimestampsRef.current[rusheeId];
    setGhostCards((prev) => {
        // Remove an existing ghost without replacing unchanged state.
        // Duplicate end events must not replace unchanged state.
        if (!prev[rusheeId]) return prev;
        const next = { ...prev };
        delete next[rusheeId];
        return next;
    });
    if (setLockedCards) {
        setLockedCards((prev) => {
            // Remove an existing card lock without replacing unchanged state.
            if (!prev[rusheeId]) return prev;
            const next = { ...prev };
            delete next[rusheeId];
            return next;
        });
    }
}
