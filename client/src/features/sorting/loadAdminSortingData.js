import { groupSortingRows } from "./board.js";

// Require admin or allowlist access before loading and grouping sorting rows.
export async function loadAdminSortingData({
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
        const email = current.email ? current.email.toLowerCase() : "";
        const isAllowlisted = email && allowlist.includes(email);
        // INVARIANT: the board request follows the existing claim/allowlist gate.
        if (!(isAdmin || isAllowlisted)) {
            navigate("/login");
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
