export function showSortingGhost(msg, {
    ghostTimestampsRef, setGhostCards, setLockedCards, now, rusheeName,
}) {
    ghostTimestampsRef.current[msg.rushee_id] = now();
    setGhostCards((prev) => ({
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
        setLockedCards((prev) => ({
            ...prev,
            [msg.rushee_id]: msg.dragger_name,
        }));
    }
}

export function moveSortingGhost(msg, { ghostTimestampsRef, setGhostCards, now }) {
    ghostTimestampsRef.current[msg.rushee_id] = now();
    setGhostCards((prev) => {
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

export function clearSortingGhost(rusheeId, {
    ghostTimestampsRef, setGhostCards, setLockedCards,
}) {
    delete ghostTimestampsRef.current[rusheeId];
    setGhostCards((prev) => {
        // Duplicate end events must not replace unchanged state.
        if (!prev[rusheeId]) return prev;
        const next = { ...prev };
        delete next[rusheeId];
        return next;
    });
    if (setLockedCards) {
        setLockedCards((prev) => {
            if (!prev[rusheeId]) return prev;
            const next = { ...prev };
            delete next[rusheeId];
            return next;
        });
    }
}
