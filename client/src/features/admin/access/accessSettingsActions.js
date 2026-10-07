export function createAccessSettingsActions({
    apiBase,
    rushAppStatus,
    setRushAppStatus,
    setRushAppLoading,
    setMidtermLoading,
    setCommentVisibilityStatus,
    setCommentVisibilityLoading,
    axios,
    toast,
    auth,
}) {
    async function submitSetting({
        endpoint, payload, onSuccess, successMessage, fallbackMessage, errorMessage, setLoading,
    }) {
        try {
            const response = await axios.post(endpoint(), payload);
            if (response.data.status === "success") {
                onSuccess();
                toast.success(successMessage(), {
                    position: "top-center",
                    autoClose: 2000,
                    theme: "dark",
                });
            } else {
                toast.error(response.data.message || fallbackMessage, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch {
            // State setters and toast callbacks retain the same caught error path as the request.
            toast.error(errorMessage, {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setLoading(false);
        }
    }

    // The update endpoint replaces all rush-app flags, so preserve the other settings on each toggle.
    const handleToggleRushAppAccess = async (field, newValue) => {
        setRushAppLoading(true);

        const newStatus = {
            disable_bidcom: field === 'disable_bidcom' ? Boolean(newValue) : Boolean(rushAppStatus.disable_bidcom),
            disable_regular: field === 'disable_regular' ? Boolean(newValue) : Boolean(rushAppStatus.disable_regular),
            midterm_mode: Boolean(rushAppStatus.midterm_mode),
        };

        await submitSetting({
            endpoint: () => `${apiBase}/rush-app/update`,
            payload: newStatus,
            onSuccess: () => {
                setRushAppStatus({
                    ...newStatus,
                    updated_by: auth.currentUser?.email || "admin"
                });
            },
            successMessage: () => {
                const targetText = field === 'disable_bidcom' ? 'Bid Committee' : 'Regular Brothers';
                return `${targetText} access ${newValue ? 'disabled' : 'enabled'}`;
            },
            fallbackMessage: "Failed to update settings",
            errorMessage: "Failed to update Rush App settings",
            setLoading: setRushAppLoading,
        });
    };

    const handleToggleMidtermMode = async (newValue) => {
        setMidtermLoading(true);

        const newStatus = {
            disable_bidcom: Boolean(rushAppStatus.disable_bidcom),
            disable_regular: Boolean(rushAppStatus.disable_regular),
            midterm_mode: Boolean(newValue),
        };

        await submitSetting({
            endpoint: () => `${apiBase}/rush-app/update`,
            payload: newStatus,
            onSuccess: () => {
                setRushAppStatus({
                    ...newStatus,
                    updated_by: auth.currentUser?.email || "admin"
                });
            },
            successMessage: () => `Midterm Mode ${newValue ? 'enabled' : 'disabled'}`,
            fallbackMessage: "Failed to update Midterm Mode",
            errorMessage: "Failed to update Midterm Mode",
            setLoading: setMidtermLoading,
        });
    };

    const handleToggleCommentVisibility = async (newValue) => {
        setCommentVisibilityLoading(true);

        await submitSetting({
            endpoint: () => `${apiBase}/comment-visibility/update`,
            payload: { require_comment_to_view: newValue },
            onSuccess: () => {
                setCommentVisibilityStatus({
                    require_comment_to_view: newValue,
                    updated_by: auth.currentUser?.email || "admin"
                });
            },
            successMessage: () => newValue
                ? 'Comment viewing restricted — brothers only see their own comments'
                : 'Comment viewing open — all brothers can read every comment',
            fallbackMessage: "Failed to update settings",
            errorMessage: "Failed to update comment visibility settings",
            setLoading: setCommentVisibilityLoading,
        });
    };

    return {
        handleToggleRushAppAccess,
        handleToggleMidtermMode,
        handleToggleCommentVisibility,
    };
}
