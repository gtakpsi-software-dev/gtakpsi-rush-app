import { createAvailabilityAssignmentActions } from "./createAvailabilityAssignmentActions.js";

// Create actions to activate, reset, deactivate, and assign from the availability form.
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
    // Submit a form-management request, apply successful state, and report the outcome.
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

    // Activate the PIS availability form for brothers.
    const handleSendPISForm = () => submitForm({
        endpoint: "send-form",
        // Mark the form active with the current sent timestamp.
        onSuccess: () => setPisFormStatus({ is_active: true, sent_at: new Date().toISOString() }),
        successMessage: "PIS availability form sent to all brothers!",
        failureMessage: "Failed to send form",
    });

    // Confirm clearing submissions and request a fresh availability form.
    const handleClearAndResendPISForm = async () => {
        // Confirm destructive form and assignment changes before any state or network work.
        if (!confirm("This will clear all existing brother availability submissions and resend the form. Continue?")) {
            return;
        }
        await submitForm({
            endpoint: "clear-and-resend",
            // Mark the resent form active and clear the displayed submissions.
            onSuccess: () => {
                setPisFormStatus({ is_active: true, sent_at: new Date().toISOString() });
                setBrotherAvailabilities([]);
            },
            successMessage: "Cleared submissions and resent form!",
            failureMessage: "Failed to clear and resend",
        });
    };

    // Deactivate the availability form and update its local status.
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
