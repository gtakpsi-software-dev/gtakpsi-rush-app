import { clearSortingGhost, moveSortingGhost, showSortingGhost } from "./sortingGhostState.js";

// Apply viewer counts, remote drags, drag denials, and persisted-move refreshes.
export function handleAdminSortingMessage(msg, {
    draggingRef, ghostTimestampsRef, fetchDataRef,
    setViewerCount, setGhostCards, setLockedCards, cancelDragState,
    now = Date.now,
}) {
    switch (msg.type) {
        case "viewer_count":
            setViewerCount(msg.count);
            break;
        case "drag_start":
            if (draggingRef.current?.id !== msg.rushee_id) {
                showSortingGhost(msg, {
                    ghostTimestampsRef, setGhostCards, setLockedCards, now,
                    rusheeName: msg.rushee_name,
                });
            }
            break;
        case "drag_move":
            if (draggingRef.current?.id !== msg.rushee_id) {
                moveSortingGhost(msg, { ghostTimestampsRef, setGhostCards, now });
            }
            break;
        case "drag_end":
            clearSortingGhost(msg.rushee_id, {
                ghostTimestampsRef, setGhostCards, setLockedCards,
            });
            break;
        case "drag_denied":
            setLockedCards(/* Record the remote owner of a card whose drag was denied. */ (prev) => ({
                ...prev,
                [msg.rushee_id]: msg.dragger_name,
            }));
            if (draggingRef.current?.id === msg.rushee_id) {
                cancelDragState();
            }
            break;
        case "card_moved":
            // Clear ghost and lock state for this card (fallback if drag_end was missed)
            if (msg.rushee_id) {
                clearSortingGhost(msg.rushee_id, {
                    ghostTimestampsRef, setGhostCards, setLockedCards,
                });
            }
            if (fetchDataRef.current) {
                fetchDataRef.current();
            }
            break;
        case "current_drag":
            if (msg.active && draggingRef.current?.id !== msg.rushee_id) {
                showSortingGhost(msg, {
                    ghostTimestampsRef, setGhostCards, setLockedCards, now,
                    rusheeName: msg.rushee_name,
                });
            }
            break;
        default:
            break;
    }
}
