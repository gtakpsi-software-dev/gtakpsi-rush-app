import { SAVE_STATUS } from "./saveStatus.js";

export async function performPisAutosave({
    questions, answers, brotherA, brotherB, gtid, api, axios,
    setSaveStatus, setLastSaved,
    now = () => new Date(),
    schedule = setTimeout,
    logError = (...values) => console.error(...values),
}) {
    // Do not post an incomplete interview before its questions and rushee ID load.
    if (!questions.length || !gtid) return;

    setSaveStatus(SAVE_STATUS.SAVING);

    try {
        const pis_responses = questions.map((question) => ({
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
            setSaveStatus(SAVE_STATUS.IDLE);
        }, 2000);
    } catch (error) {
        logError("Autosave error:", error);
        setSaveStatus(SAVE_STATUS.ERROR);

        // Keep failures visible longer than successful saves.
        schedule(() => {
            setSaveStatus(SAVE_STATUS.IDLE);
        }, 3000);
    }
}
