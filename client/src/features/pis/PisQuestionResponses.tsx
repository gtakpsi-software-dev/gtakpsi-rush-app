import CollaborativeTextarea from "../collaboration/CollaborativeTextarea";
import type { CollaborationEditorSession } from "../collaboration/CollaborationEditorSession";

type Question = { question: string; question_type: string };
type Props = {
    questions: Question[];
    answers: Record<string, string>;
    handleMCChange: (question: string, answer: string) => void;
    handleAnswerChange: (question: string, answer: string, meta?: unknown) => void;
    collaboration: CollaborationEditorSession;
    currentUser: unknown;
};

export default function PisQuestionResponses({
    questions, answers, handleMCChange, handleAnswerChange,
    collaboration, currentUser,
}: Props) {
    return (
        <>
            {questions.length > 0 ? (
                questions.map((question, idx) => (
                    <div key={idx} className="mb-8">
                        <p className="text-apple-body text-black font-normal mb-4">
                            {idx + 1}. {question.question}
                        </p>

                        {question.question_type === "MC" ? (
                            <div className="flex items-center space-x-6">
                                <label className="flex items-center text-apple-body text-black font-light">
                                    <input
                                        type="radio"
                                        name={question.question}
                                        value="Yes"
                                        checked={answers[question.question] === "Yes"}
                                        onChange={(e) => handleMCChange(question.question, e.target.value)}
                                        className="mr-3 w-4 h-4 text-black focus:ring-black focus:ring-2"
                                    />
                                    Yes
                                </label>
                                <label className="flex items-center text-apple-body text-black font-light">
                                    <input
                                        type="radio"
                                        name={question.question}
                                        value="No"
                                        checked={answers[question.question] === "No"}
                                        onChange={(e) => handleMCChange(question.question, e.target.value)}
                                        className="mr-3 w-4 h-4 text-black focus:ring-black focus:ring-2"
                                    />
                                    No
                                </label>
                            </div>
                        ) : (
                            <div className="flex gap-3 items-start">
                                <div className="flex-1">
                                    <CollaborativeTextarea
                                        questionKey={question.question}
                                        value={answers[question.question] || ""}
                                        onChange={handleAnswerChange}
                                        placeholder="Your answer..."
                                        className="input-apple w-full min-h-[120px] resize-y text-apple-footnote"
                                        collaboration={collaboration}
                                        currentUser={currentUser}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ))
            ) : (
                <p className="text-apple-body text-apple-gray-600 font-light text-center py-8">No questions available.</p>
            )}
        </>
    );
}
