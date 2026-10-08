// Optimistically move a card, renumber affected columns, and enqueue the persisted move.
export function applySortingDrop(prev, { id, fromColumn, targetColumn, targetIndex, enqueueMove }) {
    const updated = { ...prev };
    const sourceList = [...updated[fromColumn]];
    const targetList = fromColumn === targetColumn ? sourceList : [...updated[targetColumn]];

    const draggedItemIndex = sourceList.findIndex(/* Find the dragged card in its source column. */ (r) => r.id === id);
    if (draggedItemIndex === -1) return prev;
    const [item] = sourceList.splice(draggedItemIndex, 1);
    const newItem = { ...item, sortingStatus: targetColumn };

    let insertAt = targetIndex;
    if (insertAt === null || insertAt === undefined || insertAt > targetList.length) {
        insertAt = targetList.length;
    }
    targetList.splice(insertAt, 0, newItem);

    if (fromColumn === targetColumn) {
        updated[targetColumn] = targetList.map(/* Assign consecutive positions after a same-column move. */ (r, idx) => ({
            ...r,
            sortingOrder: idx + 1,
        }));
    } else {
        updated[fromColumn] = sourceList.map(/* Renumber the source column after removing the card. */ (r, idx) => ({
            ...r,
            sortingOrder: idx + 1,
        }));
        updated[targetColumn] = targetList.map(/* Renumber the destination column after inserting the card. */ (r, idx) => ({
            ...r,
            sortingOrder: idx + 1,
        }));
    }

    // Queue the move after the optimistic reorder, using the index the UI actually inserted.
    enqueueMove({
        fromColumn,
        toColumn: targetColumn,
        movedRusheeId: id,
        targetIndex: insertAt,
    });

    return updated;
}
