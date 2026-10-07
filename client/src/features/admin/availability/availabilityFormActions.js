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
    const submitForm = async ({ endpoint, onSuccess, successMessage, failureMessage }) => {
        setPisFormLoading(true);
        try {
            const response = await axios.post(`${apiBase}/pis-availability/${endpoint}`);
            if (response.data.status === "success") {
                onSuccess();
                toast.success(successMessage, {
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
        } catch {
            toast.error(failureMessage, {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setPisFormLoading(false);
        }
    };

    const handleSendPISForm = () => submitForm({
        endpoint: "send-form",
        onSuccess: () => setPisFormStatus({ is_active: true, sent_at: new Date().toISOString() }),
        successMessage: "PIS availability form sent to all brothers!",
        failureMessage: "Failed to send form",
    });

    const handleClearAndResendPISForm = async () => {
        // Confirm destructive form and assignment changes before any state or network work.
        if (!confirm("This will clear all existing brother availability submissions and resend the form. Continue?")) {
            return;
        }
        await submitForm({
            endpoint: "clear-and-resend",
            onSuccess: () => {
                setPisFormStatus({ is_active: true, sent_at: new Date().toISOString() });
                setBrotherAvailabilities([]);
            },
            successMessage: "Cleared submissions and resent form!",
            failureMessage: "Failed to clear and resend",
        });
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
