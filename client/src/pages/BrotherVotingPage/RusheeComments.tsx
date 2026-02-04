import React, { useEffect, useRef } from "react";
import { useBrotherVotingContext } from "./BrotherVotingContext";
import Badges from "../../components/Badge";
import gsap from "gsap";

export default function RusheeComments() {
    const { rushee } = useBrotherVotingContext();
    const commentsRef = useRef<HTMLDivElement[]>([]);

    useEffect(() => {
        if (rushee && rushee?.comments?.length > 0) {
            gsap.fromTo(
                commentsRef.current,
                { y: -20, opacity: 0 },
                {
                    y: 0,
                    opacity: 1,
                    duration: 0.4,
                    stagger: 0.08,
                    ease: "power2.out"
                }
            );
        }
    }, [rushee?.comments]);

    if (!rushee) {
        return (
            <p className="text-lg text-apple-gray-500 font-light italic">
                No rushee selected
            </p>
        );
    }

    if (!rushee.comments || rushee.comments.length === 0) {
        return (
            <p className="text-lg text-apple-gray-500 font-light italic">
                No comments yet
            </p>
        );
    }

    return (
        <div className="space-y-4">
            {rushee.comments.map((comment, idx) => (
                <div
                    key={idx}
                    ref={(el) => (commentsRef.current[idx] = el!)}
                    className="relative bg-apple-gray-50 border border-apple-gray-200 p-4 rounded-apple"
                >
                    <div className="flex items-center gap-2 mb-3">
                        <Badges text={comment.night ? (() => {
                            if (typeof comment.night === 'string') {
                                return comment.night;
                            } else if (comment.night && typeof comment.night === 'object') {
                                return (comment.night as any).name || `Night ${new Date(comment.night).toLocaleDateString()}`;
                            }
                            return "Rush Event";
                        })() : "Rush Event"} />
                    </div>

                    <p className="text-base text-black font-light leading-relaxed">
                        <span className="font-semibold">{comment.brother_name}:</span> {comment.comment}
                    </p>

                    {comment.ratings && comment.ratings.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-apple-gray-200">
                            {comment.ratings.map((rating) => (
                                <span
                                    key={rating.name}
                                    className={`px-3 py-1 rounded-apple text-sm font-medium ${
                                        rating.value === 5 
                                            ? 'bg-green-100 text-green-700' 
                                            : 'bg-red-100 text-red-700'
                                    }`}
                                >
                                    {rating.name}: {rating.value === 5 ? "Satisfactory" : "Unsatisfactory"}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
