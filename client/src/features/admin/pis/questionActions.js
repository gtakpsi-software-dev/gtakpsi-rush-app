// Create actions to load ordered PIS questions and update question categories.
export function createQuestionActions({
    apiBase,
    categoryEdits,
    setPisQuestions,
    setPisQuestionsLoading,
    axios,
    toast,
}) {
    // Fetch and sort PIS questions, reporting request failures.
    const fetchPisQuestions = async () => {
        setPisQuestionsLoading(true);
        try {
            const response = await axios.get(`${apiBase}/get_pis_questions`);
            if (response.data.status === "success") {
                // Keep unnumbered questions after ordered prompts without mutating the response.
                const sorted = [...response.data.payload].sort((a, b) => {
                    // Order numbered questions first and place unnumbered questions last.
                    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
                    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
                    return orderA - orderB;
                });
                setPisQuestions(sorted);
            }
        } catch {
            toast.error("Failed to load PIS questions", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        }
        setPisQuestionsLoading(false);
    };

    // Save the edited category, using null for blank input, and reload questions on success.
    const saveQuestionCategory = async (q) => {
        const rawCategory = (categoryEdits[q.question] ?? q.category ?? "").trim();
        const category = rawCategory === "" ? null : rawCategory;
        try {
            const response = await axios.post(`${apiBase}/update_pis_question_category`, {
                question: q.question,
                question_type: q.question_type,
                category,
            });
            if (response.data.status === "success") {
                toast.success("Category updated!", {
                    position: "top-center",
                    autoClose: 2000,
                    theme: "dark",
                });
                fetchPisQuestions();
            } else {
                toast.error(response.data.message || "Failed to update category", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "An error occurred", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        }
    };

    return { fetchPisQuestions, saveQuestionCategory };
}
