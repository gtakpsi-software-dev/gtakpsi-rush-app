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
    // The update endpoint replaces all rush-app flags, so preserve the other settings on each toggle.
    const handleToggleRushAppAccess = async (field, newValue) => {
        setRushAppLoading(true);

        const newStatus = {
            disable_bidcom: field === 'disable_bidcom' ? Boolean(newValue) : Boolean(rushAppStatus.disable_bidcom),
            disable_regular: field === 'disable_regular' ? Boolean(newValue) : Boolean(rushAppStatus.disable_regular),
            midterm_mode: Boolean(rushAppStatus.midterm_mode),
        };

        try {
            const response = await axios.post(`${apiBase}/rush-app/update`, newStatus);
            if (response.data.status === "success") {
                setRushAppStatus({
                    ...newStatus,
                    updated_by: auth.currentUser?.email || "admin"
                });

                const targetText = field === 'disable_bidcom' ? 'Bid Committee' : 'Regular Brothers';
                toast.success(`${targetText} access ${newValue ? 'disabled' : 'enabled'}`, {
                    position: "top-center",
                    autoClose: 2000,
                    theme: "dark",
                });
            } else {
                toast.error(response.data.message || "Failed to update settings", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch {
            toast.error("Failed to update Rush App settings", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setRushAppLoading(false);
        }
    };

    const handleToggleMidtermMode = async (newValue) => {
        setMidtermLoading(true);

        const newStatus = {
            disable_bidcom: Boolean(rushAppStatus.disable_bidcom),
            disable_regular: Boolean(rushAppStatus.disable_regular),
            midterm_mode: Boolean(newValue),
        };

        try {
            const response = await axios.post(`${apiBase}/rush-app/update`, newStatus);
            if (response.data.status === "success") {
                setRushAppStatus({
                    ...newStatus,
                    updated_by: auth.currentUser?.email || "admin"
                });
                toast.success(`Midterm Mode ${newValue ? 'enabled' : 'disabled'}`, {
                    position: "top-center",
                    autoClose: 2000,
                    theme: "dark",
                });
            } else {
                toast.error(response.data.message || "Failed to update Midterm Mode", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch {
            toast.error("Failed to update Midterm Mode", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setMidtermLoading(false);
        }
    };

    const handleToggleCommentVisibility = async (newValue) => {
        setCommentVisibilityLoading(true);

        try {
            const response = await axios.post(`${apiBase}/comment-visibility/update`, {
                require_comment_to_view: newValue
            });
            if (response.data.status === "success") {
                setCommentVisibilityStatus({
                    require_comment_to_view: newValue,
                    updated_by: auth.currentUser?.email || "admin"
                });

                toast.success(newValue
                    ? 'Comment viewing restricted — brothers only see their own comments'
                    : 'Comment viewing open — all brothers can read every comment',
                {
                    position: "top-center",
                    autoClose: 2000,
                    theme: "dark",
                });
            } else {
                toast.error(response.data.message || "Failed to update settings", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch {
            toast.error("Failed to update comment visibility settings", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setCommentVisibilityLoading(false);
        }
    };

    return {
        handleToggleRushAppAccess,
        handleToggleMidtermMode,
        handleToggleCommentVisibility,
    };
}
