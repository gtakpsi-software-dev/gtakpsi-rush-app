import { applySortingDrop } from "./applySortingDrop.js";
import { processSortingMoveQueue } from "./processSortingMoveQueue.js";

// Create optimistic drop handling backed by a serialized persistence queue.
export function createAdminSortingMoveActions({
    dragging,
    setColumns,
    clearDragState,
    moveInFlightRef,
    pendingMovesRef,
    fetchDataRef,
    persistMove,
    wsSend,
    showError,
}) {
    // Process the next queued move if no other save is running.
    const processMoveQueue = () => processSortingMoveQueue({
        moveInFlightRef,
        pendingMovesRef,
        fetchDataRef,
        persistMove,
        wsSend,
        showError,
    });

    // Append a move and start queue processing.
    const enqueueMove = (payload) => {
        pendingMovesRef.current.push(payload);
        processMoveQueue();
    };

    // Apply the dropped card’s position and clear the active drag.
    const handleDrop = (targetColumn, targetIndex) => {
        if (!dragging) return;
        const { id, fromColumn } = dragging;
        setColumns(/* Reorder the current columns and enqueue the resulting move. */ (prev) => applySortingDrop(prev, {
            id, fromColumn, targetColumn, targetIndex, enqueueMove,
        }));
        clearDragState();
    };

    return { handleDrop };
}
