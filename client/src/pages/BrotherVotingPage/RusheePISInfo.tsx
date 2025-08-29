import React from "react";
import { useBrotherVotingContext } from "./BrotherVotingContext";

export default function RusheePISInfo() {
    const { rushee } = useBrotherVotingContext();

    if (!rushee || !rushee.pis || rushee.pis.length === 0) return null;

    return (
        <div className="mt-8 space-y-6">
            <div className="border-t border-apple-gray-200 pt-6">
                <h2 className="text-apple-title1 font-light text-black mb-6">PIS Information</h2>
                
                <div className="space-y-6">
                    {rushee.pis.map((pisItem, idx) => (
                        <div
                            key={idx}
                            className="bg-white border border-apple-gray-200 p-6 rounded-apple shadow-sm"
                        >
                            <div className="mb-4">
                                <h3 className="text-apple-body font-normal text-black mb-3">
                                    {idx + 1}. {pisItem.question}
                                </h3>
                            </div>
                            
                            <div className="bg-apple-gray-50 border border-apple-gray-100 p-4 rounded-apple">
                                <p className="text-apple-body text-apple-gray-800 font-light leading-relaxed">
                                    {pisItem.answer || <span className="italic text-apple-gray-500">No answer provided</span>}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
