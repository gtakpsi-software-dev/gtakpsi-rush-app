// Create brother selection and administrator or bid committee role actions.
export function createPromotionActions({
    apiBase,
    selectedBrother,
    setSelectedBrother,
    setBrotherSearch,
    setFilteredBrothers,
    setBrotherAdminStatus,
    setBrotherBidcomStatus,
    setIsPromoting,
    axios,
    toast,
}) {
    // Select a brother, update the search label, and fetch their current roles.
    const handleSelectBrother = (brother) => {
        setSelectedBrother(brother);
        const fullName = `${brother.firstname || brother.firstName || ""} ${brother.lastname || brother.lastName || ""}`.trim();
        setBrotherSearch(fullName || brother.email || "");
        setFilteredBrothers([]);
        fetchBrotherAdminStatus(brother);
    };

    // Fetch role flags using the brother’s available ID, clearing them on failure.
    const fetchBrotherAdminStatus = async (brother) => {
        // Brother records can carry Firebase or database identifiers.
        const uid = brother?.uid || brother?.id || brother?._id;
        if (!uid) {
            setBrotherAdminStatus(null);
            setBrotherBidcomStatus(null);
            return;
        }
        try {
            const response = await axios.post(`${apiBase}/get-admin-status`, { uid });
            if (response.data.status === "success") {
                setBrotherAdminStatus(response.data.admin === true);
                setBrotherBidcomStatus(response.data.bidcom === true);
            } else {
                setBrotherAdminStatus(null);
                setBrotherBidcomStatus(null);
            }
        } catch {
            setBrotherAdminStatus(null);
            setBrotherBidcomStatus(null);
        }
    };

    // INVARIANT: role changes require a selected brother with a usable UID.
    // Validate the selected brother’s UID, submit a role change, and update its status.
    const updateRole = async ({ endpoint, field, enabled, setStatus, successMessage, failureMessage }) => {
        if (!selectedBrother) {
            toast.error("Select a brother first");
            return;
        }
        const uid = selectedBrother.uid || selectedBrother.id || selectedBrother._id;
        if (!uid) {
            toast.error("No UID found for this brother");
            return;
        }
        setIsPromoting(true);
        try {
            const response = await axios.post(`${apiBase}/${endpoint}`, { uid, [field]: enabled });
            if (response.data.status === "success") {
                setStatus(enabled);
                toast.success(successMessage(), {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            } else {
                toast.error(response.data.message || failureMessage, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || failureMessage, {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setIsPromoting(false);
        }
    };

    // Grant or remove the selected brother’s administrator role.
    const handleSetAdmin = (makeAdmin) => updateRole({
        endpoint: "make-admin",
        field: "make_admin",
        enabled: makeAdmin,
        setStatus: setBrotherAdminStatus,
        // Describe the administrator-role change for the selected brother.
        successMessage: () => makeAdmin
            ? `Granted admin to ${selectedBrother.email || "brother"}`
            : `Removed admin from ${selectedBrother.email || "brother"}`,
        failureMessage: "Failed to update admin",
    });

    // Grant or remove the selected brother’s bid committee role.
    const handleSetBidcom = (makeBidcom) => updateRole({
        endpoint: "make-bidcom",
        field: "make_bidcom",
        enabled: makeBidcom,
        setStatus: setBrotherBidcomStatus,
        // Describe the bid committee role change for the selected brother.
        successMessage: () => makeBidcom
            ? `Granted bid committee access to ${selectedBrother.email || "brother"}`
            : `Removed bid committee access from ${selectedBrother.email || "brother"}`,
        failureMessage: "Failed to update bid committee",
    });

    return {
        handleSelectBrother,
        fetchBrotherAdminStatus,
        handleSetAdmin,
        handleSetBidcom,
    };
}
