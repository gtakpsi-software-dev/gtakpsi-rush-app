// Connect the sorting session, schedule stale-drag cleanup, and return teardown.
export function startSortingConnectionLifecycle({
    connect, sweep, wsRef, schedule, clear,
}) {
    connect();
    const staleCleanupInterval = schedule(sweep, 5000);

    return () => {
        // Close the current socket and stop stale-drag cleanup.
        // Reconnects replace the ref, so unmount must close the latest socket.
        if (wsRef.current) {
            wsRef.current.close();
        }
        clear(staleCleanupInterval);
    };
}
