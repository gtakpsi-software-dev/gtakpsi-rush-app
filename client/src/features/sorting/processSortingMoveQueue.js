// Persist queued moves serially, broadcasting success or reloading server order after failure.
export async function processSortingMoveQueue(deps) {
    const {
        moveInFlightRef, pendingMovesRef, fetchDataRef, persistMove, wsSend, showError,
    } = deps;

    // INVARIANT: only one move may persist at a time, so later drops keep their order.
    if (moveInFlightRef.current) return;
    const next = pendingMovesRef.current.shift();
    if (!next) return;

    moveInFlightRef.current = true;
    try {
        await persistMove(next);
        if (next.movedRusheeId && next.toColumn) {
            wsSend({ type: "card_saved", rushee_id: next.movedRusheeId, new_status: next.toColumn });
        }
    } catch {
        showError("Failed to save order; reverting");
        // A failed save invalidates queued optimistic positions; reload the server order.
        pendingMovesRef.current = [];
        if (fetchDataRef.current) {
            await fetchDataRef.current();
        }
    } finally {
        moveInFlightRef.current = false;
        processSortingMoveQueue(deps);
    }
}
