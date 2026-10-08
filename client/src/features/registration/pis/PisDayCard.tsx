export type PisSlot = {
    time: Date;
    num_available: number;
};

type PisDayCardProps = {
    day: string;
    timeslots: PisSlot[];
    selectedSlot: PisSlot | null;
    onSelect: (slot: PisSlot) => void;
};

// Choose timeslot styling based on selection, availability, and the Monday fallback.
function slotClass(slot: PisSlot, selectedSlot: PisSlot | null, isMonday: boolean) {
    const selected = slot === selectedSlot;
    const selectionClass = selected
        ? isMonday
            ? 'ring-2 ring-yellow-500 ring-offset-2 bg-yellow-500 text-white'
            : 'ring-2 ring-black ring-offset-2 bg-black text-white'
        : '';
    const availabilityClass = slot.num_available === 0
        ? 'bg-apple-gray-100 text-apple-gray-400 cursor-not-allowed border border-apple-gray-200'
        : selected
            ? isMonday
                ? 'bg-yellow-500 text-white'
                : 'bg-black text-white'
            : isMonday
                ? 'bg-yellow-100 border border-yellow-400 text-yellow-800 hover:bg-yellow-200 active:scale-95'
                : 'bg-white border border-apple-gray-300 text-black hover:bg-apple-gray-50 hover:border-apple-gray-400 active:scale-95';

    return `py-3 px-4 rounded-apple-xl transition-all duration-200 text-center ${selectionClass} ${availabilityClass}`;
}

// Display one day’s selectable PIS timeslots and Monday instructions.
export default function PisDayCard({ day, timeslots, selectedSlot, onSelect }: PisDayCardProps) {
    const jsDate = new Date(day);
    const isMonday = jsDate.getDay() === 1;

    return (
        <div
            className={`p-6 flex-shrink-0 min-w-0 rounded-apple-2xl border ${
                isMonday
                    ? "bg-yellow-50 border-yellow-300"
                    : "card-apple"
            }`}
        >
            <h2 className={`text-apple-title2 font-light text-center mb-4 ${
                isMonday ? "text-yellow-800" : "text-black"
            }`}>
                {day}
            </h2>

            {isMonday && (
                <div className="bg-yellow-100 border border-yellow-400 rounded-apple-lg p-3 mb-4">
                    <div className="flex items-start gap-2">
                        <span className="text-lg">⚠️</span>
                        <div>
                            <p className="text-apple-caption1 font-medium text-yellow-800">
                                Only select Monday if you absolutely cannot attend Sunday.
                            </p>
                            <p className="text-apple-caption2 text-yellow-700 font-light mt-1">
                                Email <a href="mailto:svuduta6@gatech.edu" className="underline font-medium">svuduta6@gatech.edu</a> with your reason.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-3 lg:grid-cols-4 gap-3 max-w-xl">
                {timeslots.map(/* Render a timeslot with its time, remaining capacity, and selection state. */ (slot, index) => (
                    <button
                        key={index}
                        onClick={/* Select this PIS timeslot. */ () => onSelect(slot)}
                        className={slotClass(slot, selectedSlot, isMonday)}
                        disabled={slot.num_available === 0}
                    >
                        <div className="text-apple-footnote font-medium">
                            {slot.time.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        </div>
                        <div className="text-apple-caption1 mt-1 opacity-75">
                            {slot.num_available > 0
                                ? `${slot.num_available} left`
                                : "Full"}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
