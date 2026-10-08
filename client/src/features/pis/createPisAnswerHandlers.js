// Create handlers for free-text and multiple-choice interview answers.
export function createPisAnswerHandlers({ setAnswers, collaboration }) {
    // Store the answer and broadcast voice-originated changes when connected.
    const handleAnswerChange = (question, answer, meta = {}) => {
        setAnswers(/* Replace this question’s answer while preserving the others. */ (prev) => ({
            ...prev,
            [question]: answer,
        }));

        // Textarea typing sends through its own debounce; voice changes need this path.
        if (collaboration.isConnected && meta?.source === 'voice') {
            collaboration.sendTextUpdate(question, answer);
        }
    };

    // Store and broadcast a multiple-choice answer when connected.
    const handleMCChange = (question, answer) => {
        setAnswers(/* Replace this question’s answer while preserving the others. */ (prev) => ({
            ...prev,
            [question]: answer,
        }));

        if (collaboration.isConnected) {
            collaboration.sendTextUpdate(question, answer);
        }
    };

    return { handleAnswerChange, handleMCChange };
}
