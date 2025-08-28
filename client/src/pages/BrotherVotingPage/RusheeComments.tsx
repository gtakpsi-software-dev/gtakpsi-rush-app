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

    if (!rushee || rushee.comments.length === 0) return null;

    return (
        <div className="mt-6 space-y-4 h-[500px] w-full overflow-y-scroll scrollbar-hide">
            {rushee.comments.map((comment, idx) => (
                <div
                    key={idx}
                    ref={(el) => (commentsRef.current[idx] = el!)}
                    className="relative bg-apple-gray-50 border border-apple-gray-200 p-4 scrollbar-hide rounded-apple hover:bg-apple-gray-100 cursor-pointer transition-all duration-200"
                >
                    <div className="flex items-center gap-2 mb-3">
                        <Badges text={"hello"} />
                    </div>

                    <p className="text-apple-body text-black font-light leading-relaxed">
                        <span className="font-normal">{comment.brother_name}:</span> {comment.comment}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-apple-gray-200">
                        {comment.ratings.map((rating) => (
                            <span
                                key={rating.name}
                                className="bg-apple-gray-100 text-apple-gray-700 px-2 py-1 rounded-apple text-apple-footnote font-light"
                            >
                                {rating.name}: {rating.value === 5 ? "Satisfactory" : "Unsatisfactory"}
                            </span>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
