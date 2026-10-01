import { parseServerDate } from "./parseServerDate.js";

export function applyPisQuestionsResponse(response, {
    setQuestions, setQuestionsAvailable, setRevealAt, onFailure,
}) {
    if (response.data.status === "success") {
        const { available, reveal_at, questions: fetchedQuestions } = response.data.payload;
        // The API has already sorted the questions; retain that order for numbering.
        setQuestions(fetchedQuestions);
        setQuestionsAvailable(available);
        setRevealAt(parseServerDate(reveal_at));
    } else if (onFailure) {
        // Initial load navigates on failure; the unlock poll keeps its current view.
        onFailure();
    }
}
