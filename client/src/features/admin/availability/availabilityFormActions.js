import { createAvailabilityAssignmentActions } from "./createAvailabilityAssignmentActions.js";

export function createAvailabilityFormActions({
    apiBase,
    pisFormStatus,
    setPisFormStatus,
    setPisFormLoading,
    setBrotherAvailabilities,
    axios,
    toast,
    confirm,
}) {
    const handleSendPISForm = async () => {
        setPisFormLoading(true);
        try {
            const response = await axios.post(`${apiBase}/pis-availability/send-form`);
            if (response.data.status === "success") {
                setPisFormStatus({ is_active: true, sent_at: new Date().toISOString() });
                toast.success("PIS availability form sent to all brothers!", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            } else {
                toast.error(response.data.message || "Failed to send form", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch {
            toast.error("Failed to send form", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setPisFormLoading(false);
        }
    };

    const handleClearAndResendPISForm = async () => {
        // Confirm destructive form and assignment changes before any state or network work.
        if (!confirm("This will clear all existing brother availability submissions and resend the form. Continue?")) {
            return;
        }
        setPisFormLoading(true);
        try {
            const response = await axios.post(`${apiBase}/pis-availability/clear-and-resend`);
            if (response.data.status === "success") {
                setPisFormStatus({ is_active: true, sent_at: new Date().toISOString() });
                setBrotherAvailabilities([]);
                toast.success("Cleared submissions and resent form!", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            } else {
                toast.error(response.data.message || "Failed to clear and resend", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch {
            toast.error("Failed to clear and resend", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setPisFormLoading(false);
        }
    };

    const handleDeactivatePISForm = async () => {
        setPisFormLoading(true);
        try {
            const response = await axios.post(`${apiBase}/pis-availability/deactivate`);
            if (response.data.status === "success") {
                setPisFormStatus({ ...pisFormStatus, is_active: false });
                toast.success("Form deactivated", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch {
            toast.error("Failed to deactivate form", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setPisFormLoading(false);
        }
    };

    const assignmentActions = createAvailabilityAssignmentActions({
        apiBase, setPisFormLoading, axios, toast, confirm,
    });

    return {
        handleSendPISForm,
        handleClearAndResendPISForm,
        handleDeactivatePISForm,
        ...assignmentActions,
    };
}
