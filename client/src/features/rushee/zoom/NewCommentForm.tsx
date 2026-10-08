import CommentWarning from "../../comments/CommentWarning";
import type { CommentWarningItem } from "../../comments/CommentWarning";
import RatingSlider from "./RatingSlider";

type NewCommentFormProps = {
    isAddingComment: boolean;
    handleAddComment: () => void;
    newComment: string;
    setNewComment: (text: string) => void;
    validateNewComment: (text: string) => void;
    commentWarnings: CommentWarningItem[];
    setCommentWarnings: (warnings: CommentWarningItem[]) => void;
    ratingFields: string[];
    ratings: Record<string, number>;
    ratingNotSeen: Record<string, boolean>;
    handleRatingChange: (field: string, value: number) => void;
    handleRatingNotSeenChange: (field: string, notSeen: boolean) => void;
    handleSubmitComment: () => void;
};

// Render the add-comment prompt or the draft form with warnings and rating controls.
export default function NewCommentForm({
    isAddingComment, handleAddComment, newComment, setNewComment,
    validateNewComment, commentWarnings, setCommentWarnings, ratingFields,
    ratings, ratingNotSeen, handleRatingChange, handleRatingNotSeenChange,
    handleSubmitComment,
}: NewCommentFormProps) {
    return (
        <>
            {!isAddingComment ? (
                <div
                    onClick={handleAddComment}
                    className="border-2 border-dashed border-apple-gray-300 p-8 rounded-apple cursor-pointer flex items-center justify-center hover:bg-apple-gray-50 hover:border-apple-gray-400 transition-all duration-300"
                >
                    <span className="text-3xl text-apple-gray-400 font-light">+</span>
                </div>
            ) : (
                <div className="bg-apple-gray-50 border border-apple-gray-200 p-6 rounded-apple">
                    <textarea
                        className="input-apple mb-4 resize-none min-h-[120px]"
                        placeholder="Add your comment..."
                        value={newComment}
                        onChange={(e) => {
                            // Update draft text and regenerate advisory warnings.
                            setNewComment(e.target.value);
                            validateNewComment(e.target.value);
                        }}
                    ></textarea>

                    <CommentWarning
                        warnings={commentWarnings}
                        onDismiss={(index) => {
                            // Dismiss the selected draft warning.
                            const newWarnings = commentWarnings.filter(/* Keep warnings other than the dismissed index. */ (_, i) => i !== index);
                            setCommentWarnings(newWarnings);
                        }}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                        {ratingFields.map(/* Render one rating category’s score and not-seen controls. */ (field) => (
                            <RatingSlider
                                key={field}
                                label={field}
                                value={ratings[field]}
                                notSeen={ratingNotSeen[field]}
                                onValueChange={/* Update this rating category’s score. */ (value) => handleRatingChange(field, value)}
                                onNotSeenChange={
                                    /* Update whether this rating category was observed. */
                                    (notSeen) => handleRatingNotSeenChange(field, notSeen)}
                            />
                        ))}
                    </div>

                    <button
                        onClick={handleSubmitComment}
                        className="btn-apple px-6 py-3 text-apple-body font-light"
                    >
                        Submit Comment
                    </button>
                </div>
            )}
        </>
    );
}
