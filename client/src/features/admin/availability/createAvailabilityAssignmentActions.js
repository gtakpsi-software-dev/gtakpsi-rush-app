export function createAvailabilityAssignmentActions({
    apiBase,
    setPisFormLoading,
    axios,
    toast,
    confirm,
}) {
    const handleAutoAssignBrothers = async () => {
        if (!confirm("This will automatically assign available brothers to all PIS slots. Continue?")) {
            return;
        }
        setPisFormLoading(true);
        try {
            const response = await axios.post(`${apiBase}/pis-availability/auto-assign`);
            if (response.data.status === "success") {
                toast.success(response.data.message, {
                    position: "top-center",
                    autoClose: 5000,
                    theme: "dark",
                });
            } else {
                toast.error(response.data.message || "Failed to auto-assign", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch {
            toast.error("Failed to auto-assign brothers", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setPisFormLoading(false);
        }
    };

    const handleClearAssignments = async () => {
        if (!confirm("This will clear all brother assignments from PIS slots. Continue?")) {
            return;
        }
        setPisFormLoading(true);
        try {
            const response = await axios.post(`${apiBase}/pis-availability/clear-assignments`);
            if (response.data.status === "success") {
                toast.success(response.data.message, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            } else {
                toast.error(response.data.message || "Failed to clear assignments", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch {
            toast.error("Failed to clear assignments", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setPisFormLoading(false);
        }
    };

    return { handleAutoAssignBrothers, handleClearAssignments };
}
