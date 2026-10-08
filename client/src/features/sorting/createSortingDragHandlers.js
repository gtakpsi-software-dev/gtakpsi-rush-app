// Create drag lifecycle handlers with remote-lock checks and throttled broadcasts.
export function createSortingDragHandlers({
    lockedCards, draggingRef, dragPositionRef, throttleRef,
    setDragging, setHoverIndex, wsSend, now = Date.now,
}) {
    // Clear local dragging and hover state without broadcasting.
    const resetDragState = () => {
        setDragging(null);
        setHoverIndex({ column: null, index: null });
        draggingRef.current = null;
    };

    // Broadcast the end of the current drag and clear local drag state.
    const endDrag = () => {
        if (draggingRef.current?.id) {
            wsSend({ type: "drag_end", rushee_id: draggingRef.current.id });
        }
        resetDragState();
    };

    // Reject locked cards or start and broadcast a drag from the card’s position.
    const handleDragStart = (rushee, fromColumn, index, e) => {
        const lockedBy = lockedCards[rushee.id];
        if (lockedBy && draggingRef.current?.id !== rushee.id) {
            e.preventDefault();
            return;
        }

        draggingRef.current = { id: rushee.id, fromColumn, index, rushee };
        setDragging({ id: rushee.id, fromColumn, index, rushee });

        const rect = e?.currentTarget?.getBoundingClientRect();
        const x = rect ? rect.left : 0;
        const y = rect ? rect.top : 0;
        dragPositionRef.current = { x, y };

        wsSend({
            type: "drag_start",
            rushee_id: rushee.id,
            rushee_name: rushee.fullName,
            x,
            y,
        });
    };

    // Update the drop indicator and throttle outgoing drag-position updates.
    const handleDragOver = (e, columnKey, index) => {
        e.preventDefault();
        setHoverIndex({ column: columnKey, index });

        // Keep drag movement near 30 fps without delaying the local drop indicator.
        const currentTime = now();
        if (!throttleRef.current || currentTime - throttleRef.current > 33) {
            throttleRef.current = currentTime;
            const x = e.clientX;
            const y = e.clientY;
            dragPositionRef.current = { x, y };
            if (draggingRef.current?.id) {
                wsSend({ type: "drag_move", rushee_id: draggingRef.current.id, x, y });
            }
        }
    };

    return {
        handleDragStart,
        handleDragOver,
        clearDragState: endDrag,
        cancelDragState: resetDragState,
        handleDragEnd: endDrag,
    };
}
