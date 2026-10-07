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
    const latest = [...remoteUpdates].reverse().find((update) => update.field === fieldKey);
    if (!latest) return;

    if (latest.version && latest.version <= lastProcessedVersionRef.current) return;

    if (latest.value === localValue) {
        if (latest.version) lastProcessedVersionRef.current = latest.version;
        return;
    }

    const applyRemote = () => {
        processingRemoteOpRef.current = true;
        setLocalValue(latest.value);
        onRemoteChange(latest.value);
        lastSentValueRef.current = latest.value;
        if (latest.version) lastProcessedVersionRef.current = latest.version;
        pendingLocalChangeRef.current = false;
        setTimer(() => processingRemoteOpRef.current = false, 0);
    };

    // Defer remote writes after recent typing to avoid replacing an active local edit mid-keystroke.
    if (now() - lastLocalInputTimeRef.current < deferMs) {
        const timer = setTimer(() => applyRemote(), deferMs);
        return () => clearTimer(timer);
    }

    applyRemote();
}
