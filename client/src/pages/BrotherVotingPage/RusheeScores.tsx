import React from "react";
import { useBrotherVotingContext } from "./BrotherVotingContext";

export default function RusheeScores() {
    const { rushee } = useBrotherVotingContext();

    if (!rushee) {
        return (
            <p className="text-lg text-apple-gray-500 font-light italic">
                No rushee selected
            </p>
        );
    }

    if (!rushee.ratings || rushee.ratings.length === 0) {
        return (
            <p className="text-lg text-apple-gray-500 font-light italic">
                No ratings available yet
            </p>
        );
    }

    return (
        <div className="space-y-5">
            {rushee.ratings.map((rating, idx) => {
                const percentage = ((rating.value / 5) * 100);
                const isGood = percentage >= 70;
                const isMedium = percentage >= 40 && percentage < 70;
                
                return (
                    <div key={idx} className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-normal text-black">
                                {rating.name}
                            </span>
                            <span className={`text-lg font-semibold ${
                                isGood ? 'text-green-600' : isMedium ? 'text-amber-600' : 'text-red-600'
                            }`}>
                                {percentage.toFixed(0)}%
                            </span>
                        </div>
                        <div className="w-full h-3 bg-apple-gray-200 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                    isGood ? 'bg-green-500' : isMedium ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                    </div>
                );
            })}
            
            {/* Overall score */}
            {rushee.ratings.length > 0 && (
                <div className="mt-6 pt-4 border-t border-apple-gray-200">
                    <div className="flex justify-between items-center">
                        <span className="text-xl font-semibold text-black">
                            Overall Score
                        </span>
                        <span className="text-2xl font-bold text-black">
                            {(rushee.ratings.reduce((sum, r) => sum + r.value, 0) / rushee.ratings.length / 5 * 100).toFixed(0)}%
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
