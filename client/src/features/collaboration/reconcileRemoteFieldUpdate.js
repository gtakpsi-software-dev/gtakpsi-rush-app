// Apply the newest unseen field update, deferring it briefly after local typing.
export function reconcileRemoteFieldUpdate({
    remoteUpdates,
    fieldKey,
    localValue,
    lastProcessedVersionRef,
    lastLocalInputTimeRef,
    processingRemoteOpRef,
    pendingLocalChangeRef,
    lastSentValueRef,
    setLocalValue,
    onRemoteChange,
    deferMs,
    now = Date.now,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
}) {
    const latest = [...remoteUpdates].reverse().find(/* Match remote updates for this field. */ (update) => update.field === fieldKey);
    if (!latest) return;

    if (latest.version && latest.version <= lastProcessedVersionRef.current) return;

    if (latest.value === localValue) {
        if (latest.version) lastProcessedVersionRef.current = latest.version;
        return;
    }

    // Apply the remote value and version while clearing pending local-edit state.
    const applyRemote = () => {
        processingRemoteOpRef.current = true;
        setLocalValue(latest.value);
        onRemoteChange(latest.value);
        lastSentValueRef.current = latest.value;
        if (latest.version) lastProcessedVersionRef.current = latest.version;
        pendingLocalChangeRef.current = false;
        setTimer(/* Release the remote-operation guard on the next timer turn. */ () => processingRemoteOpRef.current = false, 0);
    };

    // Defer remote writes after recent typing to avoid replacing an active local edit mid-keystroke.
    if (now() - lastLocalInputTimeRef.current < deferMs) {
        const timer = setTimer(/* Apply the deferred remote value after the local typing window. */ () => applyRemote(), deferMs);
        return /* Cancel the deferred remote update when the caller cleans up. */ () => clearTimer(timer);
    }

    applyRemote();
}
