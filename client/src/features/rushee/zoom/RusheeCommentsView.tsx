import type { ComponentProps } from "react";
import ExistingCommentList from "./ExistingCommentList";
import NewCommentForm from "./NewCommentForm";

type Props = {
    rusheeComments: { brother_name: string }[];
    showAllComments: boolean;
    newCommentFormProps: ComponentProps<typeof NewCommentForm>;
    existingCommentListProps: ComponentProps<typeof ExistingCommentList>;
    showVisibilityNotice: boolean;
};

export default function RusheeCommentsView({
    rusheeComments,
    showAllComments,
    newCommentFormProps,
    existingCommentListProps,
    showVisibilityNotice,
}: Props) {
    return (
        <>
            {showAllComments && rusheeComments.length > 0 && (
                <div className="card-apple p-6 mb-6">
                    <h2 className="text-apple-title1 font-light text-black mb-4">
                        Brothers Who Commented
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {rusheeComments.map((comment, idx) => (
                            <div
                                key={idx}
                                className="bg-apple-gray-100 text-apple-gray-700 px-3 py-2 rounded-apple hover:bg-apple-gray-200 cursor-pointer transform transition-all duration-200 ease-in-out hover:scale-105 text-apple-footnote font-light"
                            >
                                {comment.brother_name}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="card-apple p-6 mb-6">
                <h2 className="text-apple-title1 font-light text-black mb-4">
                    Comments
                </h2>
                <NewCommentForm {...newCommentFormProps} />

                <ExistingCommentList {...existingCommentListProps} />

                {showVisibilityNotice && (
                    <div className="mt-6 p-6 bg-apple-gray-50 border border-apple-gray-200 rounded-apple text-center">
                        <p className="text-apple-body text-apple-gray-600 font-light">
                            Post your comment to save your ratings and notes. You won't see other brothers' comments.
                        </p>
                    </div>
                )}
            </div>
        </>
    );
}
