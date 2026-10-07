import RusheeInteractionsByNight from "../../../components/RusheeInteractionsByNight";
import type { Rushee } from "./types";

export default function CurrentRusheePreview({ rushee }: { rushee: Rushee | null }) {
    return (
        <>
            {rushee ? (
                <div className="card-apple flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-apple">
                    <img
                        src={rushee.image_url}
                        alt={`${rushee.first_name} ${rushee.last_name}`}
                        className="w-32 h-32 object-cover rounded-apple-2xl border border-apple-gray-200"
                    />

                    <div className="flex-1 w-full space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="text-apple-title1 font-light text-black">
                                {rushee.first_name} {rushee.last_name}
                            </h2>
                            <p className="text-apple-footnote text-apple-gray-600 font-light">
                                GTID: {rushee.gtid}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-4 text-apple-footnote text-apple-gray-600 font-light">
                            <span><span className="text-black font-normal">Major:</span> {rushee.major}</span>
                            <span><span className="text-black font-normal">Pronouns:</span> {rushee.pronouns}</span>
                        </div>

                        <RusheeInteractionsByNight
                            nights={rushee.interactions_by_night}
                            attendance={rushee.attendance}
                            comments={rushee.comments}
                        />

                        {rushee.ratings && rushee.ratings.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {rushee.ratings.map((rating, idx) => (
                                    <span
                                        key={idx}
                                        className="bg-apple-gray-100 text-apple-gray-700 px-2 py-1 rounded-apple text-apple-caption1 font-light"
                                    >
                                        {rating.name}: {rating.value.toFixed(2)}/5.00
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="card-apple p-8 rounded-apple text-center">
                    <p className="text-apple-gray-400 text-apple-body font-light italic">
                        No rushee selected. Use the search bar above to find and select a rushee.
                    </p>
                </div>
            )}
        </>
    );
}
