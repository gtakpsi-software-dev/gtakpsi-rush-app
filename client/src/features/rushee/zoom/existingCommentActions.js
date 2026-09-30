export function createExistingCommentActions({
    rushee,
    error,
    editedCommentText,
    gtid,
    api,
    setEditingCommentId,
    setEditedCommentText,
    setEditCommentWarnings,
    setLoading,
    validateComment,
    generateWarnings,
    toast,
    axios,
    reload,
    log,
}) {
    const validateEditComment = (commentText) => {
        if (!rushee) return;

        const validationResult = validateComment(commentText, rushee.first_name, rushee.last_name);
        const warnings = generateWarnings(validationResult);
        setEditCommentWarnings(warnings);
    };

    const handleEditComment = (comment) => {
        setEditingCommentId(comment.comment);
        setEditedCommentText(comment.comment);
        setEditCommentWarnings([]);
    };

    const handleSubmitEdit = async (comment) => {
        log(comment);

        if (!rushee) return;

        const validationResult = validateComment(editedCommentText, rushee.first_name, rushee.last_name);

        if (validationResult.hasWarnings) {
            const warnings = generateWarnings(validationResult);
            setEditCommentWarnings(warnings);

            // Keep warnings advisory while submitting the edited comment.
            toast.warning("Edited comment contains potentially problematic language. Please review before submitting.", {
                position: "top-center",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "dark",
            });
        }

        setLoading(true);
        const payload = {
            brother_id: "000000",
            brother_name: comment.brother_name,
            comment: editedCommentText,
            ratings: comment.ratings,
            night: comment.night,
        };

        await axios.post(`${api}/rushee/edit-comment/${gtid}`, payload)
            .then((response) => {
                if (response.data.status === "success") {
                    reload();
                } else {
                    toast.error(`${response.data.message}`, {
                        position: "top-center",
                        autoClose: 5000,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                        progress: undefined,
                        theme: "dark",
                    });
                }
            })
            .catch(() => {
                // Preserve the page's error-state log; the rejected request is not logged here.
                log(error);
                toast.error(`Some network error occurred`, {
                    position: "top-center",
                    autoClose: 5000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: "dark",
                });
            });

        setEditingCommentId(null);
        setEditedCommentText("");
        setEditCommentWarnings([]);
        setLoading(false);
    };

    const handleDeleteComment = async (comment) => {
        setLoading(true);

        await axios.post(`${api}/rushee/delete-comment/${gtid}`, comment)
            .then((response) => {
                if (response.data.status === "success") {
                    reload();
                } else {
                    toast.error(`${response.data.message}`, {
                        position: "top-center",
                        autoClose: 5000,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                        progress: undefined,
                        theme: "dark",
                    });
                }
            })
            .catch((error) => {
                log(error);

                toast.error(`Some network error occurred`, {
                    position: "top-center",
                    autoClose: 5000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: "dark",
                });
            });

        setLoading(false);
    };

    return {
        validateEditComment,
        handleEditComment,
        handleSubmitEdit,
        handleDeleteComment,
    };
}
