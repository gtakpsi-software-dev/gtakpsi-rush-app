export function handleBidComSortingMessage(msg, {
    ghostTimestampsRef, fetchDataRef, setViewerCount, setGhostCards, now = Date.now,
}) {
    switch (msg.type) {
        case "viewer_count":
            setViewerCount(msg.count);
            break;
        case "drag_start":
            ghostTimestampsRef.current[msg.rushee_id] = now();
            setGhostCards((prev) => ({
                ...prev,
                [msg.rushee_id]: {
                    rusheeId: msg.rushee_id,
                    // INVARIANT: viewer ghosts never display names sent by the broadcaster.
                    rusheeName: "Rushee",
                    x: msg.x,
                    y: msg.y,
                    draggerName: msg.dragger_name,
                },
            }));
            break;
        case "drag_move":
            ghostTimestampsRef.current[msg.rushee_id] = now();
            setGhostCards((prev) => {
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
            break;
        case "drag_end":
            delete ghostTimestampsRef.current[msg.rushee_id];
            setGhostCards((prev) => {
                if (!prev[msg.rushee_id]) return prev;
                const next = { ...prev };
                delete next[msg.rushee_id];
                return next;
            });
            break;
        case "card_moved":
            if (msg.rushee_id) {
                delete ghostTimestampsRef.current[msg.rushee_id];
                setGhostCards((prev) => {
                    if (!prev[msg.rushee_id]) return prev;
                    const next = { ...prev };
                    delete next[msg.rushee_id];
                    return next;
                });
            }
            if (fetchDataRef.current) {
                fetchDataRef.current();
            }
            break;
        case "current_drag":
            if (msg.active) {
                ghostTimestampsRef.current[msg.rushee_id] = now();
                setGhostCards((prev) => ({
                    ...prev,
                    [msg.rushee_id]: {
                        rusheeId: msg.rushee_id,
                        rusheeName: "Rushee",
                        x: msg.x,
                        y: msg.y,
                        draggerName: msg.dragger_name,
                    },
                }));
            }
            break;
        default:
            break;
    }
}
