// Reuse a tab-local fallback so reconnects keep the same collaborator identity.
// A backend ID takes precedence when one is available.
export function getStableUserId(backendId) {
    if (backendId) return backendId;

    const STORAGE_KEY = "collab_stable_user_id";
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    const newId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(STORAGE_KEY, newId);
    return newId;
}
