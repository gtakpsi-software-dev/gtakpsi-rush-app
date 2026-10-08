import Badges from '../../components/Badge';
import RusheeInteractionsByNight from '../../components/RusheeInteractionsByNight';
import type { NightInteractionSummary } from '../rushee/interactions.types';

type DashboardRushee = {
    gtid: string;
    image_url: string;
    name: string;
    attendance: { name: string }[];
    email: string;
    major: string;
    interactions_by_night: NightInteractionSummary[];
    ratings?: { name: string; value: number }[];
};

type DashboardRusheeCardProps = {
    rushee: DashboardRushee;
    isMidtermMode: boolean;
    showRatings: boolean;
    onOpen: () => void;
};

// Display a rushee summary with attendance, interactions, and optional ratings.
export default function DashboardRusheeCard({
    rushee,
    isMidtermMode,
    showRatings,
    onOpen,
}: DashboardRusheeCardProps) {
    return (
        <div
            onClick={isMidtermMode ? undefined : onOpen}
            className={`card-apple transition-all duration-200 ${isMidtermMode ? "cursor-default" : "cursor-pointer hover:border-apple-gray-300 hover:scale-[1.02] active:scale-[0.98]"}`}
        >
            <img
                className="w-full h-48 object-cover rounded-t-apple-2xl"
                src={rushee.image_url}
                alt={rushee.name}
            />

            <div className="p-5">
                <div className="flex flex-col gap-2 mb-3">
                    <div className="flex items-start justify-between gap-2">
                        <h2 className="text-apple-title1 font-normal text-black leading-tight">
                            {rushee.name}
                        </h2>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {rushee.attendance.map(/* Render a badge for an attended rush event. */ (event, idx) => (
                            <Badges text={event.name} key={idx} />
                        ))}
                    </div>
                </div>

                <div className="space-y-1 mb-3">
                    <p className="text-apple-footnote text-apple-gray-600 font-light truncate">
                        {rushee.email}
                    </p>
                    <p className="text-apple-footnote text-apple-gray-600 font-light truncate">
                        {rushee.major}
                    </p>
                    <p className="text-apple-footnote text-apple-gray-600 font-light">
                        GTID: {rushee.gtid}
                    </p>
                    <RusheeInteractionsByNight
                        nights={rushee.interactions_by_night}
                        compact
                    />
                </div>

                {showRatings && rushee.ratings && rushee.ratings.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {rushee.ratings.map(/* Render an aggregate rating rounded to two decimal places. */ (rating, rIdx) => (
                            <span
                                key={rIdx}
                                className="bg-apple-gray-100 text-apple-gray-700 px-2 py-1 rounded-apple text-apple-caption1 font-light"
                            >
                                {rating.name}: {rating.value.toFixed(2)}/5.00
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
