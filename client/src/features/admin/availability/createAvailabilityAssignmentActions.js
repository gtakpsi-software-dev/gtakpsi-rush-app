export function createAvailabilityAssignmentActions({
    apiBase,
    setPisFormLoading,
    axios,
    toast,
    confirm,
}) {
    const runAssignmentAction = async ({ confirmation, endpoint, successTimeout, failureMessage, requestFailureMessage }) => {
        if (!confirm(confirmation)) {
            return;
        }
        setPisFormLoading(true);
        try {
            const response = await axios.post(`${apiBase}/pis-availability/${endpoint}`);
            if (response.data.status === "success") {
                toast.success(response.data.message, {
                    position: "top-center",
                    autoClose: successTimeout,
                    theme: "dark",
                });
            } else {
                toast.error(response.data.message || failureMessage, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch {
            toast.error(requestFailureMessage, {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setPisFormLoading(false);
        }
    };

    const handleAutoAssignBrothers = () => runAssignmentAction({
        confirmation: "This will automatically assign available brothers to all PIS slots. Continue?",
        endpoint: "auto-assign",
        successTimeout: 5000,
        failureMessage: "Failed to auto-assign",
        requestFailureMessage: "Failed to auto-assign brothers",
    });

    const handleClearAssignments = () => runAssignmentAction({
        confirmation: "This will clear all brother assignments from PIS slots. Continue?",
        endpoint: "clear-assignments",
        successTimeout: 3000,
        failureMessage: "Failed to clear assignments",
        requestFailureMessage: "Failed to clear assignments",
    });

    return { handleAutoAssignBrothers, handleClearAssignments };
}
