export function getRealtimeBaseUrls(env) {
    // Preserve deployed variable names and each service's original fallback behavior.
    return {
        pisCollaboration: env.VITE_WEBSOCKET_URL || "http://localhost:3001",
        sorting: env.VITE_SORTING_BROADCASTER_URL || "ws://localhost:4001",
        voting: env.VITE_BROADCASTER_API_PREFIX,
    };
}

export const realtimeBaseUrls = getRealtimeBaseUrls(import.meta.env || {});
