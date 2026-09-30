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
    const handleSelectBrother = (brother) => {
        setSelectedBrother(brother);
        const fullName = `${brother.firstname || brother.firstName || ""} ${brother.lastname || brother.lastName || ""}`.trim();
        setBrotherSearch(fullName || brother.email || "");
        setFilteredBrothers([]);
        fetchBrotherAdminStatus(brother);
    };

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
    const handleSetAdmin = async (makeAdmin) => {
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
            const response = await axios.post(`${apiBase}/make-admin`, { uid, make_admin: makeAdmin });
            if (response.data.status === "success") {
                setBrotherAdminStatus(makeAdmin);
                toast.success(
                    makeAdmin
                        ? `Granted admin to ${selectedBrother.email || "brother"}`
                        : `Removed admin from ${selectedBrother.email || "brother"}`,
                    {
                        position: "top-center",
                        autoClose: 3000,
                        theme: "dark",
                    }
                );
            } else {
                toast.error(response.data.message || "Failed to update admin", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to update admin", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setIsPromoting(false);
        }
    };

    const handleSetBidcom = async (makeBidcom) => {
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
            const response = await axios.post(`${apiBase}/make-bidcom`, { uid, make_bidcom: makeBidcom });
            if (response.data.status === "success") {
                setBrotherBidcomStatus(makeBidcom);
                toast.success(
                    makeBidcom
                        ? `Granted bid committee access to ${selectedBrother.email || "brother"}`
                        : `Removed bid committee access from ${selectedBrother.email || "brother"}`,
                    {
                        position: "top-center",
                        autoClose: 3000,
                        theme: "dark",
                    }
                );
            } else {
                toast.error(response.data.message || "Failed to update bid committee", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to update bid committee", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setIsPromoting(false);
        }
    };

    return {
        handleSelectBrother,
        fetchBrotherAdminStatus,
        handleSetAdmin,
        handleSetBidcom,
    };
}
