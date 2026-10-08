import { createPisCollaborator } from "./createPisCollaborator.js";
import { applyPisQuestionsResponse } from "./applyPisQuestionsResponse.js";
import { applyPisRusheeResponse } from "./applyPisRusheeResponse.js";

// Verify the session, establish collaborator identity, and load the rushee and PIS questions.
export async function loadPisPageData({
    verifyUser,
    navigate,
    errorTitle,
    errorDescription,
    currentUser,
    auth,
    getStoredUser,
    setCurrentUser,
    get,
    api,
    gtid,
    setRushee,
    setAnswers,
    setBrotherA,
    setBrotherB,
    setQuestions,
    setQuestionsAvailable,
    setRevealAt,
    setLoading,
    logError,
}) {
    await verifyUser()
        .then(async (response) => {
            // Handle verification and load rushee details before requesting questions.
            if (response === false) {
                navigate(`/error/${errorTitle}/${errorDescription}`);
            }

            if (!currentUser || !currentUser.id) {
                setCurrentUser(createPisCollaborator(auth.currentUser, getStoredUser()));
            }

            await get(`${api}/rushee/${gtid}`)
                .then((response) => {
                    // Hydrate interview state from the rushee response.
                    applyPisRusheeResponse(response, {
                        setRushee, setAnswers, setBrotherA, setBrotherB,
                        navigate, errorTitle,
                    });
                });

            // The questions request follows rushee hydration, even if identity verification returned false.
            await get(`${api}/rushee/get-pis-questions/${gtid}`)
                .then((response) => {
                    // Apply question availability and reveal timing from the response.
                    applyPisQuestionsResponse(response, {
                        setQuestions, setQuestionsAvailable, setRevealAt,
                        // Navigate to the question-loading error page.
                        onFailure: () => navigate(`/error/${errorTitle}/${"Failed to fetch PIS questions"}`),
                    });
                });
        })
        .catch((error) => {
            // Log a bootstrap failure and navigate to the configured error page.
            logError(error);
            navigate(`/error/${errorTitle}/${errorDescription}`);
        });

    setLoading(false);
}
