export function scheduleLocalChangeTimers({
    pendingLocalChangeRef,
    pendingLocalChangeTimeoutRef,
    debounceTimerRef,
    collaboration,
    fieldKey,
    value,
    lastSentValueRef,
    debounceMs,
    allowSend,
    schedule,
    cancel,
}) {
    // Clear the pending marker even offline so remote reconciliation can resume.
    if (pendingLocalChangeTimeoutRef.current) {
        cancel(pendingLocalChangeTimeoutRef.current);
    }
    pendingLocalChangeTimeoutRef.current = schedule(() => {
        pendingLocalChangeRef.current = false;
    }, 2000);

    if (allowSend && collaboration.isConnected) {
        if (debounceTimerRef.current) cancel(debounceTimerRef.current);
        debounceTimerRef.current = schedule(() => {
            collaboration.sendTextUpdate(fieldKey, value);
            lastSentValueRef.current = value;
        }, debounceMs);
    }
}

export function clearLocalChangeTimers({
    debounceTimerRef,
    pendingLocalChangeTimeoutRef,
    cancel,
}) {
    // Read the current IDs so unmount clears timers rescheduled after the first render.
    if (debounceTimerRef.current) cancel(debounceTimerRef.current);
    if (pendingLocalChangeTimeoutRef.current) cancel(pendingLocalChangeTimeoutRef.current);
}
