import { createCommentToastOptions } from "./commentToastOptions.js";

export function createCommentCreateActions({
    rushee,
    user,
    gtid,
    api,
    navigate,
    ratings,
    ratingNotSeen,
    newComment,
    ratingFields,
    setIsAddingComment,
    setCommentWarnings,
    setRatings,
    setRatingNotSeen,
    setLoading,
    setNewComment,
    createDefaultRatings,
    createDefaultNotSeen,
    validateComment,
    generateWarnings,
    toast,
    axios,
    reload,
    log,
}) {
    const handleAddComment = () => {
        setIsAddingComment(true);
        setCommentWarnings([]);
        setRatings(createDefaultRatings());
        setRatingNotSeen(createDefaultNotSeen());
    };

    const handleRatingChange = (field, value) => {
        setRatings({
            ...ratings,
            [field]: value,
        });
    };

    const handleRatingNotSeenChange = (field, notSeen) => {
        setRatingNotSeen({
            ...ratingNotSeen,
            [field]: notSeen,
        });
    };

    const validateNewComment = (commentText) => {
        if (!rushee) return;

        const validationResult = validateComment(commentText, rushee.first_name, rushee.last_name);
        const warnings = generateWarnings(validationResult);
        setCommentWarnings(warnings);
    };

    const handleSubmitComment = async () => {
        if (!rushee) return;

        const validationResult = validateComment(newComment, rushee.first_name, rushee.last_name);

        if (validationResult.hasWarnings) {
            const warnings = generateWarnings(validationResult);
            setCommentWarnings(warnings);

            // Warn without blocking the existing comment submission flow.
            toast.warning("Comment contains potentially problematic language. Please review before submitting.", createCommentToastOptions());
        }

        setLoading(true);

        const actualRatings = [];

        for (const field of ratingFields) {
            if (!ratingNotSeen[field]) {
                actualRatings.push({
                    name: field,
                    value: ratings[field],
                });
            }
        }

        const payload = {
            brother_id: "000000",
            brother_name: user.firstname + " " + user.lastname,
            comment: newComment,
            ratings: actualRatings,
        };

        log(user);

        await axios.post(`${api}/rushee/post-comment/${gtid}`, payload)
            .then((response) => {
                if (response.data.status === "success") {
                    reload();
                } else {
                    toast.error(`${response.data.message}`, createCommentToastOptions());
                }
            })
            .catch((error) => {
                log(error);

                const title = "Uh Oh! Something weird happened...";
                const description = "Some network error happened while submitting your comment...";
                navigate(`/error/${title}/${description}`);
            });

        // Reset after both success and failure responses, as the page already does.
        setNewComment("");
        setCommentWarnings([]);
        setRatings(createDefaultRatings());
        setRatingNotSeen(createDefaultNotSeen());
        setIsAddingComment(false);
        setLoading(false);
    };

    return {
        handleAddComment,
        handleRatingChange,
        handleRatingNotSeenChange,
        validateNewComment,
        handleSubmitComment,
    };
}
