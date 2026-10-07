import type { Dispatch, SetStateAction } from "react";

type PisQuestion = {
    question: string;
    question_type: string;
    order?: number | null;
    category?: string | null;
};

type PisQuestionsCardProps = {
    question: string;
    setQuestion: (value: string) => void;
    questionType: string;
    setQuestionType: (value: string) => void;
    questionOrder: number | string;
    setQuestionOrder: (value: number | string) => void;
    questionCategory: string;
    setQuestionCategory: (value: string) => void;
    handleRequest: (endpoint: string, payload: Record<string, unknown>, method: string, successMessage: string) => Promise<void>;
    fetchPisQuestions: () => Promise<void>;
    pisQuestions: PisQuestion[];
    pisQuestionsLoading: boolean;
    categoryEdits: Record<string, string>;
    setCategoryEdits: Dispatch<SetStateAction<Record<string, string>>>;
    saveQuestionCategory: (question: PisQuestion) => Promise<void>;
};

export default function PisQuestionsCard({
    question,
    setQuestion,
    questionType,
    setQuestionType,
    questionOrder,
    setQuestionOrder,
    questionCategory,
    setQuestionCategory,
    handleRequest,
    fetchPisQuestions,
    pisQuestions,
    pisQuestionsLoading,
    categoryEdits,
    setCategoryEdits,
    saveQuestionCategory,
}: PisQuestionsCardProps) {
    return (
        <div className="card-apple p-6">
            <h3 className="text-apple-headline font-normal text-black mb-4">PIS Questions</h3>
            <div className="space-y-3 mb-4">
                <input
                    type="text"
                    placeholder="Question text"
                    className="input-apple text-apple-body"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Question type (e.g., FR, MC)"
                    className="input-apple text-apple-body"
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value)}
                />
                <input
                    type="number"
                    placeholder="Question order (e.g., 1)"
                    className="input-apple text-apple-body"
                    value={questionOrder}
                    onChange={(e) => {
                        const value = e.target.value;
                        setQuestionOrder(value === "" ? "" : Number(value));
                    }}
                />
                <input
                    type="text"
                    placeholder="Category (leave blank for a fixed, always-shown question)"
                    className="input-apple text-apple-body"
                    value={questionCategory}
                    onChange={(e) => setQuestionCategory(e.target.value)}
                />
                <p className="text-apple-caption text-apple-gray-400">
                    Questions with the same category form a random-draw bucket &mdash; one is randomly picked per category, per rushee, 5 minutes before their PIS. Leave category blank for logistics/MC questions or anything that should always be asked.
                </p>
            </div>
            <div className="flex gap-3">
                <button
                    onClick={async () => {
                        const order = questionOrder === "" ? undefined : Number(questionOrder);
                        const category = questionCategory.trim() === "" ? undefined : questionCategory.trim();
                        await handleRequest("add_pis_question", { question, question_type: questionType, order, category }, "post", "Question added!");
                        fetchPisQuestions();
                    }}
                    className="flex-1 bg-black text-white py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-800 transition-all duration-200"
                >
                    Add Question
                </button>
                <button
                    onClick={async () => {
                        await handleRequest("delete_pis_question", { question, question_type: questionType }, "post", "Question deleted!");
                        fetchPisQuestions();
                    }}
                    className="flex-1 bg-white text-red-600 py-3 px-4 rounded-apple-xl text-apple-body font-light border border-red-200 hover:bg-red-50 transition-all duration-200"
                >
                    Delete Question
                </button>
            </div>

            <div className="mt-6 pt-6 border-t border-apple-gray-200">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-apple-body font-normal text-black">Question Bank &amp; Categories</h4>
                    <button
                        onClick={fetchPisQuestions}
                        className="text-apple-caption text-apple-gray-500 hover:text-black transition-colors"
                    >
                        {pisQuestionsLoading ? "Refreshing..." : "Refresh"}
                    </button>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {pisQuestions.map((q, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-3 bg-apple-gray-50 rounded-apple-lg">
                            <div className="flex-1 min-w-0">
                                <p className="text-apple-body text-black truncate">{q.question}</p>
                                <p className="text-apple-caption text-apple-gray-400">{q.question_type} &middot; order {q.order ?? "—"}</p>
                            </div>
                            <input
                                type="text"
                                placeholder="Fixed (no category)"
                                className="input-apple text-apple-caption w-48"
                                value={categoryEdits[q.question] ?? q.category ?? ""}
                                onChange={(e) => setCategoryEdits((prev) => ({ ...prev, [q.question]: e.target.value }))}
                            />
                            <button
                                onClick={() => saveQuestionCategory(q)}
                                className="text-apple-caption bg-black text-white px-3 py-2 rounded-apple-lg hover:bg-apple-gray-800 transition-colors whitespace-nowrap"
                            >
                                Save
                            </button>
                        </div>
                    ))}
                    {pisQuestions.length === 0 && !pisQuestionsLoading && (
                        <p className="text-apple-caption text-apple-gray-400">No PIS questions yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
