export function createPisAnswerHandlers({ setAnswers, collaboration }) {
    const handleAnswerChange = (question, answer, meta = {}) => {
        setAnswers((prev) => ({
            ...prev,
            [question]: answer,
        }));

        // Textarea typing sends through its own debounce; voice changes need this path.
        if (collaboration.isConnected && meta?.source === 'voice') {
            collaboration.sendTextUpdate(question, answer);
        }
    };

    const handleMCChange = (question, answer) => {
        setAnswers((prev) => ({
            ...prev,
            [question]: answer,
        }));

        if (collaboration.isConnected) {
            collaboration.sendTextUpdate(question, answer);
        }
    };

    return { handleAnswerChange, handleMCChange };
}
