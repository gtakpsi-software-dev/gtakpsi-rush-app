import { groupSortingRows } from "./board.js";

// Require committee, admin, or allowlist access before loading sorting rows.
export async function loadBidCommitteeSortingData({
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
