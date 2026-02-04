import React from "react";
import { useBrotherVotingContext } from "./BrotherVotingContext";

export default function RusheePISInfo() {
    const { rushee } = useBrotherVotingContext();

    if (!rushee) {
        return (
            <p className="text-lg text-apple-gray-500 font-light italic">
                No rushee selected
            </p>
        );
    }

    if (!rushee.pis || rushee.pis.length === 0) {
        return (
            <p className="text-lg text-apple-gray-500 font-light italic">
                No PIS information available
            </p>
        );
    }

    return (
        <div className="space-y-5">
            {rushee.pis.map((pisItem, idx) => (
                <div
                    key={idx}
                    className="bg-apple-gray-50 border border-apple-gray-200 p-4 rounded-apple"
                >
                    <p className="text-base font-semibold text-black mb-3">
                        {idx + 1}. {pisItem.question}
                    </p>
                    <div className="bg-white border border-apple-gray-100 p-4 rounded-apple">
                        <p className="text-base text-apple-gray-800 font-light leading-relaxed">
                            {pisItem.answer || <span className="italic text-apple-gray-400">No answer provided</span>}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}
