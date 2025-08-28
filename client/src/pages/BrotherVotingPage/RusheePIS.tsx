import React from "react";
import { useBrotherVotingContext } from "./BrotherVotingContext";

interface PisResponse {
    question: string;
    answer: string;
}

export default function RusheePIS() {
    const { rushee } = useBrotherVotingContext();

    // Check if rushee has PIS data (assuming it's in the rushee object)
    if (!rushee || !rushee.pis || rushee.pis.length === 0) {
        return (
            <div className="p-6 bg-apple-gray-50 border border-apple-gray-200 rounded-apple">
                <h3 className="text-apple-title2 font-semibold text-black mb-4 tracking-tight">
                    PIS Questions & Answers
                </h3>
                <div className="text-center text-apple-gray-500">
                    <p className="text-apple-body font-light">No PIS responses available</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-apple-gray-50 border border-apple-gray-200 rounded-apple">
            <h3 className="text-apple-title2 font-semibold text-black mb-4 tracking-tight">
                PIS Questions & Answers
            </h3>
            
            <div className="space-y-4 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-apple-gray-300 scrollbar-track-apple-gray-100">
                {rushee.pis.map((pisItem: PisResponse, index: number) => (
                    <div 
                        key={index}
                        className="bg-white border border-apple-gray-200 rounded-apple p-4 hover:shadow-sm transition-shadow duration-200"
                    >
                        <div className="mb-3">
                            <h4 className="text-apple-body font-medium text-black mb-2">
                                Question {index + 1}
                            </h4>
                            <p className="text-apple-body text-apple-gray-700 font-light leading-relaxed">
                                {pisItem.question}
                            </p>
                        </div>
                        
                        <div className="pt-3 border-t border-apple-gray-200">
                            <h5 className="text-apple-footnote font-medium text-black mb-2">
                                Answer
                            </h5>
                            <p className="text-apple-body text-black font-light leading-relaxed break-words">
                                {pisItem.answer || "No answer provided"}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
