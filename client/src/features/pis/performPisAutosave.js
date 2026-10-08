import { SAVE_STATUS } from "./saveStatus.js";

// Save interview answers and brother names, then show temporary success or error status.
export async function performPisAutosave({
    questions, answers, brotherA, brotherB, gtid, api, axios,
    setSaveStatus, setLastSaved,
    now = /* Return the current save-completion time. */ () => new Date(),
    schedule = setTimeout,
    logError = /* Log an autosave error with its context. */ (...values) => console.error(...values),
}) {
    // Do not post an incomplete interview before its questions and rushee ID load.
    if (!questions.length || !gtid) return;

    setSaveStatus(SAVE_STATUS.SAVING);

    try {
        const pis_responses = questions.map(/* Build a question-answer entry, using an empty string for an unanswered question. */ (question) => ({
            question: question.question,
            answer: answers[question.question] || "",
        }));

        // Keep the API's field names and empty-answer fallback unchanged.
        const payload = {
            pis_responses,
            brother_a_first_name: brotherA.firstName,
            brother_a_last_name: brotherA.lastName,
            brother_b_first_name: brotherB.firstName,
            brother_b_last_name: brotherB.lastName,
        };

        await axios.post(`${api}/rushee/autosave-pis/${gtid}`, payload);

        setSaveStatus(SAVE_STATUS.SAVED);
        setLastSaved(now());

        // Retain the existing two-second success feedback before returning to idle.
        schedule(() => {
            // Return the successful save indicator to idle.
            setSaveStatus(SAVE_STATUS.IDLE);
        }, 2000);
    } catch (error) {
        logError("Autosave error:", error);
        setSaveStatus(SAVE_STATUS.ERROR);

        // Keep failures visible longer than successful saves.
        schedule(() => {
            // Return the failed save indicator to idle.
            setSaveStatus(SAVE_STATUS.IDLE);
        }, 3000);
    }
}
