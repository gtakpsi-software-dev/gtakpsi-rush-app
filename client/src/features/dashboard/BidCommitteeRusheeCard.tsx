import Badges from '../../components/Badge';
import RusheeInteractionsByNight from '../../components/RusheeInteractionsByNight';
import type { NightInteractionSummary } from '../rushee/interactions.types';

type BidCommitteeRushee = {
    attendance: { name: string }[];
    interactions_by_night: NightInteractionSummary[];
    ratings: { name: string; value: number }[];
};

type BidCommitteeRusheeCardProps = {
    rushee: BidCommitteeRushee;
    rusheeId: string;
    onOpen: () => void;
};

// Display an anonymous rushee card with attendance, interactions, and ratings.
export default function BidCommitteeRusheeCard({
    rushee,
    rusheeId,
    onOpen,
}: BidCommitteeRusheeCardProps) {
    return (
        <div
            onClick={onOpen}
            className="card-apple cursor-pointer hover:border-apple-gray-300 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
        >
            <div className="w-full h-48 bg-apple-gray-100 flex items-center justify-center rounded-t-apple-2xl border-b border-apple-gray-200">
                <span className="text-6xl font-light text-black">
                    {rusheeId}
                </span>
            </div>

            <div className="flex flex-col flex-grow p-4">
                <div className="flex flex-row gap-4 items-center mb-2">
                    <h2 className="text-apple-title1 font-normal text-black truncate">
                        Rushee #{rusheeId}
                    </h2>
                    {rushee.attendance.map(/* Render a badge for an attended rush event. */ (event, idx) => (
                        <Badges text={event.name} key={idx} />
                    ))}
                </div>

                <RusheeInteractionsByNight
                    nights={rushee.interactions_by_night}
                    compact
                    className="mb-2"
                />

                <div className="flex flex-wrap gap-2 mt-2">
                    {rushee.ratings.map(/* Render an aggregate rating rounded to two decimal places. */ (rating, rIdx) => (
                        <span
                            key={rIdx}
                            className="bg-apple-gray-100 text-apple-gray-700 px-2 py-1 rounded-apple text-apple-caption1 font-light"
                        >
                            {rating.name}: {rating.value.toFixed(2)}/5.00
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
