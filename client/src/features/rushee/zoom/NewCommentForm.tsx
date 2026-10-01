import CommentWarning from "../../../components/CommentWarning";
import type { CommentWarningItem } from "../../../components/CommentWarning";
import RatingSlider from "../../../components/RatingSlider";

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
                            setNewComment(e.target.value);
                            validateNewComment(e.target.value);
                        }}
                    ></textarea>

                    <CommentWarning
                        warnings={commentWarnings}
                        onDismiss={(index) => {
                            const newWarnings = commentWarnings.filter((_, i) => i !== index);
                            setCommentWarnings(newWarnings);
                        }}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                        {ratingFields.map((field) => (
                            <RatingSlider
                                key={field}
                                label={field}
                                value={ratings[field]}
                                notSeen={ratingNotSeen[field]}
                                onValueChange={(value) => handleRatingChange(field, value)}
                                onNotSeenChange={(notSeen) => handleRatingNotSeenChange(field, notSeen)}
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
