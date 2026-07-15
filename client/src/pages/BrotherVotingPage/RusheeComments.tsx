import React, { useEffect, useRef, useState } from "react";
import { useBrotherVotingContext } from "./BrotherVotingContext";
import Badges from "../../components/Badge";
import gsap from "gsap";
import { formatRatingValue, ratingBadgeClass } from "../../js/ratingDisplay";
import { getVisibleComments, shouldShowAllComments } from "../../js/commentVisibility";
import axios from "axios";
import { auth } from "../../firebase";

export default function RusheeComments() {
    const { rushee } = useBrotherVotingContext();
    const commentsRef = useRef<HTMLDivElement[]>([]);
    const [requireCommentToView, setRequireCommentToView] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isBidcom, setIsBidcom] = useState(false);

    const storedUser = localStorage.getItem("user");
    const user = storedUser ? JSON.parse(storedUser) : null;

    useEffect(() => {
        async function fetchVisibility() {
            const api = import.meta.env.VITE_API_PREFIX;
            try {
                const res = await axios.get(`${api}/brother/comment-visibility/status`);
                if (res.data.status === "success") {
                    setRequireCommentToView(res.data.require_comment_to_view);
                }
            } catch {
                // default: restricted
            }

            const currentUser = auth.currentUser;
            if (currentUser) {
                try {
                    const tokenResult = await currentUser.getIdTokenResult(true);
                    setIsAdmin(tokenResult.claims?.admin === true);
                    setIsBidcom(tokenResult.claims?.bidcom === true);
                } catch {
                    // ignore
                }
            }
        }
        fetchVisibility();
    }, []);

    const visibilityOptions = { requireCommentToView, isAdmin, isBidcom };
    const visibleComments = rushee
        ? getVisibleComments(rushee.comments, user, visibilityOptions)
        : [];

    useEffect(() => {
        if (rushee && visibleComments.length > 0) {
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
    }, [rushee?.comments, visibleComments.length]);

    if (!rushee) {
        return (
            <p className="text-lg text-apple-gray-500 font-light italic">
                No rushee selected
            </p>
        );
    }

    if (!visibleComments || visibleComments.length === 0) {
        return (
            <p className="text-lg text-apple-gray-500 font-light italic">
                {shouldShowAllComments(visibilityOptions) ? "No comments yet" : "No comments from you yet"}
            </p>
        );
    }

    return (
        <div className="space-y-4">
            {visibleComments.map((comment, idx) => (
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
                                    className={`px-3 py-1 rounded-apple text-sm font-medium ${ratingBadgeClass(rating.value)}`}
                                >
                                    {rating.name}: {formatRatingValue(rating.value)}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
