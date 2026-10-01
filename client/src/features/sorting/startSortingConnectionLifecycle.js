export function startSortingConnectionLifecycle({
    connect, sweep, wsRef, schedule, clear,
}) {
    connect();
    const staleCleanupInterval = schedule(sweep, 5000);

    return () => {
        // Reconnects replace the ref, so unmount must close the latest socket.
        if (wsRef.current) {
            wsRef.current.close();
        }
        clear(staleCleanupInterval);
    };
}
