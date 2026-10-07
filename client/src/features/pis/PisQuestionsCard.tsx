import type { ComponentProps } from "react";
import PisBrotherFields from "./PisBrotherFields";
import PisQuestionResponses from "./PisQuestionResponses";
import PisSaveStatus from "./PisSaveStatus";

type Props = ComponentProps<typeof PisBrotherFields>
    & ComponentProps<typeof PisQuestionResponses>
    & ComponentProps<typeof PisSaveStatus>
    & { collaboration: { isConnected: boolean } };

export default function PisQuestionsCard({
    rushee,
    brotherA,
    brotherB,
    collaboration,
    currentUser,
    handleBrotherAChange,
    handleBrotherBChange,
    questions,
    answers,
    handleMCChange,
    handleAnswerChange,
    saveStatus,
    lastSaved,
}: Props) {
    return (
        <div className="card-apple p-6 mb-6">
            <h1 className="text-apple-title1 font-light text-black mb-6">PIS Questions</h1>

            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-apple">
                <div className="flex items-center justify-between">
                    <p className="text-apple-footnote text-green-800 font-light">
                        <span className="font-normal">Autosave Enabled:</span> All changes are automatically saved every few seconds, just like Google Docs.
                        Multiple people can collaborate on this form in real-time!
                    </p>
                    <div className="ml-4 flex-shrink-0">
                        <PisSaveStatus saveStatus={saveStatus} lastSaved={lastSaved} />
                    </div>
                </div>
                {!collaboration.isConnected && (
                    <p className="mt-2 text-orange-600 text-apple-footnote">
                        ⚠️ Real-time collaboration is currently offline, but autosave is still working.
                    </p>
                )}
            </div>

            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-apple">
                <p className="text-apple-footnote text-blue-800 font-light">
                    <span className="font-normal">Tip:</span> Only one person should type in each text box at a time to avoid conflicts.
                    You can see when others are typing in a field.
                </p>
            </div>

            <PisBrotherFields
                rushee={rushee}
                brotherA={brotherA}
                brotherB={brotherB}
                collaboration={collaboration}
                currentUser={currentUser}
                handleBrotherAChange={handleBrotherAChange}
                handleBrotherBChange={handleBrotherBChange}
            />

            <PisQuestionResponses
                questions={questions}
                answers={answers}
                handleMCChange={handleMCChange}
                handleAnswerChange={handleAnswerChange}
                collaboration={collaboration}
                currentUser={currentUser}
            />

            <div className="mt-8 pt-6 border-t border-apple-gray-200 flex items-center justify-between">
                <p className="text-apple-footnote text-apple-gray-500">
                    All changes are automatically saved
                </p>
                <PisSaveStatus saveStatus={saveStatus} lastSaved={lastSaved} />
            </div>
        </div>
    );
}
