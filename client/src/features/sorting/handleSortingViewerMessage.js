import { clearSortingGhost, moveSortingGhost, showSortingGhost } from "./sortingGhostState.js";

export function handleSortingViewerMessage(msg, {
    ghostTimestampsRef, fetchDataRef, setViewerCount, setGhostCards,
    showRusheeNames = false, now = Date.now,
}) {
    switch (msg.type) {
        case "viewer_count":
            setViewerCount(msg.count);
            break;
        case "drag_start":
            // INVARIANT: bid committee viewers must use the redacted label.
            showSortingGhost(msg, {
                ghostTimestampsRef, setGhostCards, now,
                rusheeName: showRusheeNames ? msg.rushee_name : "Rushee",
            });
            break;
        case "drag_move":
            moveSortingGhost(msg, { ghostTimestampsRef, setGhostCards, now });
            break;
        case "drag_end":
            clearSortingGhost(msg.rushee_id, { ghostTimestampsRef, setGhostCards });
            break;
        case "card_moved":
            if (msg.rushee_id) {
                clearSortingGhost(msg.rushee_id, { ghostTimestampsRef, setGhostCards });
            }
            if (fetchDataRef.current) {
                fetchDataRef.current();
            }
            break;
        case "current_drag":
            if (msg.active) {
                // INVARIANT: replayed drags follow the same name visibility rule as new drags.
                showSortingGhost(msg, {
                    ghostTimestampsRef, setGhostCards, now,
                    rusheeName: showRusheeNames ? msg.rushee_name : "Rushee",
                });
            }
            break;
        default:
            break;
    }
}
