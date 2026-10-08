import { groupSortingRows } from "./board.js";

// Require a signed-in user before loading and grouping the brother sorting board.
export async function loadBrotherSortingData({
    auth, navigate, apiBase, getSorting, setColumns, setLoading, showError,
}) {
    try {
        const current = auth.currentUser;
        if (!current) {
            navigate("/login");
            return;
        }

        const response = await getSorting(`${apiBase}/sorting`);
        if (response.data.status === "success") {
            setColumns(groupSortingRows(response.data.payload));
        } else {
            showError("Failed to load rushees");
        }
    } catch {
        showError("Failed to load rushees");
    } finally {
        setLoading(false);
    }
}
