import { groupSortingRows } from "./board.js";

/**
 * Bid Committee Sorting Summary:
 * - Separates the existing access and fetch sequence from page rendering.
 * - Retains forced claim refresh, claim/allowlist access, and final state order.
 */
export async function loadBidComSortingData({
    auth, navigate, allowlist, apiBase, getSorting,
    setColumns, setLoading, setAuthChecked, showError,
}) {
    try {
        const current = auth.currentUser;
        if (!current) {
            navigate("/login");
            return;
        }

        const tokenResult = await current.getIdTokenResult(true);
        const isAdmin = tokenResult.claims?.admin === true;
        const isBidcom = tokenResult.claims?.bidcom === true;
        const email = current.email ? current.email.toLowerCase() : "";
        const isAllowlisted = email && allowlist.includes(email);

        // INVARIANT: only a matching claim or allowlisted email may request the board.
        if (!(isAdmin || isBidcom || isAllowlisted)) {
            showError("Access denied - Bid Committee or Admin only");
            navigate("/dashboard");
            return;
        }

        const response = await getSorting(`${apiBase}/rushees/sorting`);
        if (response.data.status === "success") {
            setColumns(groupSortingRows(response.data.payload));
        } else {
            showError("Failed to load rushees");
        }
    } catch {
        showError("Failed to load rushees");
    } finally {
        setLoading(false);
        setAuthChecked(true);
    }
}
