import { applySortingDrop } from "./applySortingDrop.js";
import { processSortingMoveQueue } from "./processSortingMoveQueue.js";

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
    const processMoveQueue = () => processSortingMoveQueue({
        moveInFlightRef,
        pendingMovesRef,
        fetchDataRef,
        persistMove,
        wsSend,
        showError,
    });

    const enqueueMove = (payload) => {
        pendingMovesRef.current.push(payload);
        processMoveQueue();
    };

    const handleDrop = (targetColumn, targetIndex) => {
        if (!dragging) return;
        const { id, fromColumn } = dragging;
        setColumns((prev) => applySortingDrop(prev, {
            id, fromColumn, targetColumn, targetIndex, enqueueMove,
        }));
        clearDragState();
    };

    return { handleDrop };
}
