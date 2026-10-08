// Synchronize parent values while preserving remote-operation and pending-local-edit guards.
export function syncPropValue({
    value,
    localValue,
    processingRemoteOpRef,
    pendingLocalChangeRef,
    setLocalValue,
    lastSentValueRef,
}) {
    if (processingRemoteOpRef.current) return;

    // Wait for the parent to echo local typing before accepting another value.
    if (pendingLocalChangeRef.current) {
        if (value === localValue) {
            pendingLocalChangeRef.current = false;
        }
        return;
    }

    if (value !== localValue) {
        const newValue = value || '';
        setLocalValue(newValue);
        lastSentValueRef.current = newValue;
    }
}
