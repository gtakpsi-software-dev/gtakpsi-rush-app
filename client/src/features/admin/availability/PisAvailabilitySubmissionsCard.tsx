export type BrotherAvailability = {
    brother_first_name: string;
    brother_last_name: string;
    available_timeslots?: unknown[];
};

type PisAvailabilitySubmissionsCardProps = {
    brotherAvailabilities: BrotherAvailability[];
    onEditAvailability: (brother: BrotherAvailability) => void;
};

// Display submitted availability counts and buttons to edit each brother’s slots.
export default function PisAvailabilitySubmissionsCard({
    brotherAvailabilities,
    onEditAvailability,
}: PisAvailabilitySubmissionsCardProps) {
    return (
        <div className="card-apple p-6">
            <h3 className="text-apple-headline font-normal text-black mb-2">Submissions</h3>
            <div className="flex items-center gap-4 mb-4">
                <div className="text-3xl font-light text-black">
                    {brotherAvailabilities.length}
                </div>
                <div className="text-apple-footnote text-apple-gray-600 font-light">
                    brothers have submitted their availability
                </div>
            </div>

            <p className="text-apple-caption2 text-apple-gray-500 mb-3 font-light">
                Click on a name to edit their availability
            </p>

            {brotherAvailabilities.length > 0 && (
                <div className="bg-apple-gray-50 rounded-apple-lg p-3 max-h-48 overflow-y-auto border border-apple-gray-100">
                    <div className="flex flex-wrap gap-2">
                        {brotherAvailabilities.map(/* Render a brother’s name and submitted timeslot count. */ (avail, idx) => (
                            <button
                                key={idx}
                                onClick={/* Open the editor for this brother’s availability. */ () => onEditAvailability(avail)}
                                className="text-apple-caption1 bg-white px-3 py-1.5 rounded-apple border border-apple-gray-200 text-apple-gray-700 hover:bg-apple-gray-100 hover:border-apple-gray-300 transition-all cursor-pointer font-light"
                            >
                                {avail.brother_first_name} {avail.brother_last_name}
                                <span className="ml-1 text-apple-gray-400">
                                    ({avail.available_timeslots?.length || 0})
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
