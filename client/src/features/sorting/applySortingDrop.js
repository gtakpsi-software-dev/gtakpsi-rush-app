export function applySortingDrop(prev, { id, fromColumn, targetColumn, targetIndex, enqueueMove }) {
    const updated = { ...prev };
    const sourceList = [...updated[fromColumn]];
    const targetList = fromColumn === targetColumn ? sourceList : [...updated[targetColumn]];

    const draggedItemIndex = sourceList.findIndex((r) => r.id === id);
    if (draggedItemIndex === -1) return prev;
    const [item] = sourceList.splice(draggedItemIndex, 1);
    const newItem = { ...item, sortingStatus: targetColumn };

    let insertAt = targetIndex;
    if (insertAt === null || insertAt === undefined || insertAt > targetList.length) {
        insertAt = targetList.length;
    }
    targetList.splice(insertAt, 0, newItem);

    if (fromColumn === targetColumn) {
        updated[targetColumn] = targetList.map((r, idx) => ({
            ...r,
            sortingOrder: idx + 1,
        }));
    } else {
        updated[fromColumn] = sourceList.map((r, idx) => ({
            ...r,
            sortingOrder: idx + 1,
        }));
        updated[targetColumn] = targetList.map((r, idx) => ({
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
