type Props = {
    question: string;
    setQuestion: (value: string) => void;
    questionType: string;
    setQuestionType: (value: string) => void;
    questionCategory: string;
    setQuestionCategory: (value: string) => void;
    onSubmit: () => void;
};

export default function AddPisQuestionForm({
    question,
    setQuestion,
    questionType,
    setQuestionType,
    questionCategory,
    setQuestionCategory,
    onSubmit,
}: Props) {
    return (
        <div className="container mx-auto p-6 bg-gray-100 min-h-screen">
            <div className="bg-white p-6 rounded-lg shadow-md max-w-lg mx-auto">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Add PIS Question</h2>
                <input
                    type="text"
                    placeholder="Enter Question"
                    className="border border-gray-300 rounded-md p-3 w-full mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Enter Question Type"
                    className="border border-gray-300 rounded-md p-3 w-full mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Category (blank = always shown to every rushee)"
                    className="border border-gray-300 rounded-md p-3 w-full mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={questionCategory}
                    onChange={(e) => setQuestionCategory(e.target.value)}
                />
                <button
                    onClick={onSubmit}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-5 rounded-lg w-full transition duration-200"
                >
                    Add Question
                </button>
            </div>
        </div>
    );
}
