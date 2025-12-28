import React, { useState, useRef } from "react";
import { useAdminVotingContext } from "./AdminVotingContext";
import { adminPost } from "../../js/adminAxios";
import { toast } from "react-toastify";

export default function QuestionDisplay() {

    const { question, setQuestion } = useAdminVotingContext();
    const [editing, setEditing] = useState(false);
    const [inputValue, setInputValue] = useState(question || ""); // fix this bug because question hasn't resolved yet, ashwin is too lazy
    const inputRef = useRef<HTMLInputElement>(null);

    const lambdaURL = import.meta.env.VITE_API_PREFIX;

    const handleSendQuestion = async () => {
        if (inputValue.trim() !== question) {
            const payload = { question: inputValue };

            // Show loader → then success or error toast
            await toast.promise(
                (async () => {
                    // First, set the new question
                    await adminPost(`${lambdaURL}/admin/voting/post-question`, payload);
                    
                    // Then, clear all existing votes since they're for the old question
                    await adminPost(`${lambdaURL}/admin/voting/clear-votes`, {});
                    
                    return { success: true };
                })(),
                {
                    pending: "Updating question and clearing votes...",
                    success: "Question updated and votes cleared! 🎉",
                    error: "Failed to update question ❌",
                },
                {
                    position: "top-center",
                    theme: "light",
                }
            );
        }
        setEditing(false);
    };

    const handleCancel = () => {
        setInputValue(question || "");
        setEditing(false);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSendQuestion();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    const handleClick = () => {
        setEditing(true);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    return (
        <div
            onClick={handleClick}
            className="card-apple p-6 rounded-apple shadow-sm hover:shadow-md transition-shadow duration-150 cursor-text"
        >
            <label className="text-apple-footnote text-apple-gray-600 font-light block mb-3">
                Current Question
            </label>

            {editing ? (
                <div className="space-y-4">
                    <input
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyPress}
                        className="w-full text-apple-title1 text-black bg-transparent outline-none border-b border-apple-gray-300 focus:border-black transition-all duration-150"
                        placeholder="Enter your question..."
                    />
                    <div className="flex gap-3">
                        <button
                            onClick={handleSendQuestion}
                            className="px-4 py-2 bg-black text-white text-apple-body font-normal rounded-apple hover:bg-apple-gray-800 transition-colors duration-150"
                        >
                            Send Question
                        </button>
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2 bg-apple-gray-200 text-apple-gray-700 text-apple-body font-normal rounded-apple hover:bg-apple-gray-300 transition-colors duration-150"
                        >
                            Cancel
                        </button>
                    </div>
                    <p className="text-apple-footnote text-apple-gray-500">
                        Press Enter to send, Escape to cancel<br/>
                        <span className="text-orange-600">Note: Setting a new question will clear all existing votes</span>
                    </p>
                </div>
            ) : (
                <p className={`text-apple-title1 text-black ${!question && "text-apple-gray-400 italic"}`}>
                    {question || "Click to set question..."}
                </p>
            )}
        </div>
    );
}
