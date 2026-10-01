import RusheeInteractionsByNight from "../../../components/RusheeInteractionsByNight";
import type { NightInteractionSummary } from "../interactions.types";

type RusheeRatingsProps = {
    rushee: {
        ratings: { name: string; value: number }[];
        interactions_by_night?: NightInteractionSummary[];
        attendance: unknown[];
        comments: unknown[];
    };
    showAllComments: boolean;
};

export default function RusheeRatings({ rushee, showAllComments }: RusheeRatingsProps) {
    return (
        <div className="card-apple p-6 mb-6">
            <h2 className="text-apple-title1 font-light text-black mb-4">Ratings</h2>

            {showAllComments ? (
                <div className="flex flex-col gap-4">
                    {rushee.ratings.map((rating, idx) => (
                        <div key={idx} className="w-full">
                            <p className="text-apple-body text-black font-normal mb-2">{rating.name}</p>
                            <div className="w-full bg-apple-gray-100 rounded-apple h-3">
                                <div
                                    className="bg-black h-3 rounded-apple transition-all duration-300"
                                    style={{ width: `${(rating.value / 5) * 100}%` }}
                                ></div>
                            </div>
                            <p className="text-apple-footnote text-apple-gray-600 font-light mt-1">{`${rating.value.toFixed(2)}/5.00`}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-apple-footnote text-apple-gray-500 font-light italic">
                    Ratings are hidden until comment viewing is enabled
                </p>
            )}

            <div className="mt-6 pt-4 border-t border-apple-gray-200">
                <h3 className="text-apple-headline font-light text-black mb-2">
                    Interactions
                </h3>
                <RusheeInteractionsByNight
                    nights={rushee.interactions_by_night}
                    attendance={rushee.attendance}
                    comments={rushee.comments}
                />
            </div>
        </div>
    );
}
