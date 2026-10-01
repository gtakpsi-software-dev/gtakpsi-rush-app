import { FaEdit, FaTrash } from "react-icons/fa";

import Badges from "../../../components/Badge";
import CommentWarning from "../../../components/CommentWarning";
import type { CommentWarningItem } from "../../../components/CommentWarning";
import { formatRatingValue } from "../../../js/ratingDisplay";

type Comment = {
    brother_name: string;
    comment: string;
    night: { name: string };
    ratings: { name: string; value: number | string }[];
};

type ExistingCommentListProps = {
    visibleComments: Comment[];
    user: { firstname: string; lastname: string };
    editingCommentId: string | null;
    editedCommentText: string;
    setSelectedComment: (comment: Comment) => void;
    handleEditComment: (comment: Comment) => void;
    handleDeleteComment: (comment: Comment) => void;
    setEditedCommentText: (text: string) => void;
    validateEditComment: (text: string) => void;
    editCommentWarnings: CommentWarningItem[];
    setEditCommentWarnings: (warnings: CommentWarningItem[]) => void;
    handleSubmitEdit: (comment: Comment) => void;
};

export default function ExistingCommentList({
    visibleComments, user, editingCommentId, editedCommentText,
    setSelectedComment, handleEditComment, handleDeleteComment,
    setEditedCommentText, validateEditComment, editCommentWarnings,
    setEditCommentWarnings, handleSubmitEdit,
}: ExistingCommentListProps) {
    // INVARIANT: the page supplies access-filtered comments; never render the full comment list here.
    return (
        <>
            {visibleComments.length > 0 && (
                <div className="mt-6 space-y-4">
                    {visibleComments.map((comment, idx) => (
                        <div
                            key={idx}
                            onClick={() => setSelectedComment(comment)}
                            className="relative bg-apple-gray-50 border border-apple-gray-200 p-4 rounded-apple hover:bg-apple-gray-100 cursor-pointer transition-all duration-200"
                        >
                            <div
                                className={
                                    user.firstname + " " + user.lastname === comment.brother_name &&
                                        editingCommentId !== comment.comment
                                        ? "absolute top-3 right-3 flex space-x-2"
                                        : "hidden"
                                }
                            >
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditComment(comment);
                                    }}
                                    className="text-apple-gray-500 hover:text-black text-lg transition-colors"
                                >
                                    <FaEdit />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteComment(comment);
                                    }}
                                    className="text-apple-gray-500 hover:text-red-600 text-lg transition-colors"
                                >
                                    <FaTrash />
                                </button>
                            </div>

                            {editingCommentId === comment.comment ? (
                                <div onClick={(e) => e.stopPropagation()}>
                                    <textarea
                                        className="input-apple mb-4 resize-none min-h-[120px]"
                                        value={editedCommentText}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => {
                                            setEditedCommentText(e.target.value);
                                            validateEditComment(e.target.value);
                                        }}
                                    ></textarea>

                                    <CommentWarning
                                        warnings={editCommentWarnings}
                                        onDismiss={(index) => {
                                            const newWarnings = editCommentWarnings.filter((_, i) => i !== index);
                                            setEditCommentWarnings(newWarnings);
                                        }}
                                    />

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSubmitEdit(comment);
                                        }}
                                        className="btn-apple px-4 py-2 text-apple-footnote font-light"
                                    >
                                        Update Comment
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Badges text={comment.night.name} />
                                    </div>
                                    <p className="text-apple-body text-black font-light leading-relaxed">
                                        <span className="font-normal">{comment.brother_name}:</span> {comment.comment}
                                    </p>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-apple-gray-200">
                                {comment.ratings.map((rating, rIdx) => (
                                    <span
                                        key={rIdx}
                                        className="bg-apple-gray-100 text-apple-gray-700 px-2 py-1 rounded-apple text-apple-footnote font-light"
                                    >
                                        {rating.name}: {formatRatingValue(rating.value)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
