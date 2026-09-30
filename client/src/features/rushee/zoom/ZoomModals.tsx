import { formatRatingValue } from "../../../js/ratingDisplay";

type ZoomComment = {
    brother_name: string;
    comment: string;
    ratings: { name: string; value: number }[];
};

type ZoomPis = { question: string; answer: string };

type ZoomModalsProps = {
    selectedComment: ZoomComment | null;
    selectedPis: ZoomPis | null;
    onCloseComment: () => void;
    onClosePis: () => void;
};

export default function ZoomModals({ selectedComment, selectedPis, onCloseComment, onClosePis }: ZoomModalsProps) {
    return (
        <>
            {selectedComment && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
                    onClick={() => onCloseComment()}
                >
                    <div
                        className="card-apple p-6 w-11/12 max-w-2xl transform scale-100 transition-transform duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="text-apple-gray-600 hover:text-black float-right text-2xl font-light focus:outline-none"
                            onClick={() => onCloseComment()}
                        >
                            ×
                        </button>

                        <h3 className="text-apple-title1 font-light mb-4 text-black clear-right">
                            Comment from <span className="font-normal text-black">{selectedComment.brother_name}</span>
                        </h3>
                        <p className="text-apple-body text-black font-light mb-6 leading-relaxed">{selectedComment.comment}</p>

                        <div className="flex flex-wrap gap-2 mt-4">
                            {selectedComment.ratings.map((rating, rIdx) => (
                                <span
                                    key={rIdx}
                                    className="bg-apple-gray-100 text-apple-gray-700 px-2 py-1 rounded-apple text-apple-footnote font-light"
                                >
                                    {rating.name}: {formatRatingValue(rating.value)}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {selectedPis && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
                    onClick={() => onClosePis()}
                >
                    {/* This inner box stops clicks from propagating to backdrop */}
                    <div
                        className="card-apple p-6 w-11/12 max-w-2xl transform scale-100 transition-transform duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="text-apple-gray-600 hover:text-black float-right text-2xl font-light focus:outline-none"
                            onClick={() => onClosePis()}
                        >
                            ×
                        </button>

                        <div className="clear-right">
                            <h3 className="text-apple-title2 font-normal text-apple-gray-700 mt-2">Question:</h3>
                            <p className="text-apple-body text-black font-light mb-6 leading-relaxed">{selectedPis.question}</p>

                            <h3 className="text-apple-title2 font-normal text-apple-gray-700">Answer:</h3>
                            <p className="text-apple-body text-black font-light leading-relaxed">{selectedPis.answer}</p>
                        </div>
                    </div>
                </div>
            )}

        </>
    );
}
