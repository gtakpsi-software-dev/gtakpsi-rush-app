import { createCommentToastOptions } from "./commentToastOptions.js";

// Create actions for drafting, rating, validating, and submitting a new comment.
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
    // Open the comment form with cleared warnings and default ratings.
    const handleAddComment = () => {
        setIsAddingComment(true);
        setCommentWarnings([]);
        setRatings(createDefaultRatings());
        setRatingNotSeen(createDefaultNotSeen());
    };

    // Update one rating value in the draft.
    const handleRatingChange = (field, value) => {
        setRatings({
            ...ratings,
            [field]: value,
        });
    };

    // Update whether a rating category was observed.
    const handleRatingNotSeenChange = (field, notSeen) => {
        setRatingNotSeen({
            ...ratingNotSeen,
            [field]: notSeen,
        });
    };

    // Generate advisory warnings for the draft comment.
    const validateNewComment = (commentText) => {
        if (!rushee) return;

        const validationResult = validateComment(commentText, rushee.first_name, rushee.last_name);
        const warnings = generateWarnings(validationResult);
        setCommentWarnings(warnings);
    };

    // Submit the comment and observed ratings, then reset the form after the request.
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
                // Reload after success or show the API’s comment-submission error.
                if (response.data.status === "success") {
                    reload();
                } else {
                    toast.error(`${response.data.message}`, createCommentToastOptions());
                }
            })
            .catch((error) => {
                // Log the request failure and navigate to the submission error page.
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
