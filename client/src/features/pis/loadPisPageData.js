import { createPisCollaborator } from "./createPisCollaborator.js";
import { applyPisQuestionsResponse } from "./applyPisQuestionsResponse.js";
import { applyPisRusheeResponse } from "./applyPisRusheeResponse.js";

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
            if (response === false) {
                navigate(`/error/${errorTitle}/${errorDescription}`);
            }

            if (!currentUser || !currentUser.id) {
                setCurrentUser(createPisCollaborator(auth.currentUser, getStoredUser()));
            }

            await get(`${api}/rushee/${gtid}`)
                .then((response) => {
                    applyPisRusheeResponse(response, {
                        setRushee, setAnswers, setBrotherA, setBrotherB,
                        navigate, errorTitle,
                    });
                });

            // The questions request follows rushee hydration, even if identity verification returned false.
            await get(`${api}/rushee/get-pis-questions/${gtid}`)
                .then((response) => {
                    applyPisQuestionsResponse(response, {
                        setQuestions, setQuestionsAvailable, setRevealAt,
                        onFailure: () => navigate(`/error/${errorTitle}/${"Failed to fetch PIS questions"}`),
                    });
                });
        })
        .catch((error) => {
            logError(error);
            navigate(`/error/${errorTitle}/${errorDescription}`);
        });

    setLoading(false);
}
