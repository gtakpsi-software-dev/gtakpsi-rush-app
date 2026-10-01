import { formatTimeslot, timeslotIso } from './timeslots';

type Timeslot = {
    time: { $date: { $numberLong: string } };
};

type PISAvailabilityViewProps = {
    loading: boolean;
    timeslots: Timeslot[];
    selectedSlots: Set<string>;
    submitting: boolean;
    groupedSlots: Record<string, Timeslot[]>;
    selectAll: () => void;
    clearAll: () => void;
    toggleSlot: (slotIso: string) => void;
    handleSubmit: () => void;
};

export default function PISAvailabilityView({
    loading,
    timeslots,
    selectedSlots,
    submitting,
    groupedSlots,
    selectAll,
    clearAll,
    toggleSlot,
    handleSubmit,
}: PISAvailabilityViewProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            <div className="relative bg-white rounded-apple-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden mx-4 border border-apple-gray-200">
                <div className="bg-black px-6 py-5">
                    <h2 className="text-apple-title1 font-normal text-white">
                        PIS Availability Form
                    </h2>
                    <p className="text-apple-footnote text-apple-gray-400 mt-1 font-light">
                        Select all timeslots you&apos;re available to host PIS interviews (or submit with none if unavailable)
                    </p>
                </div>

                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black"></div>
                        </div>
                    ) : timeslots.length === 0 ? (
                        <div className="text-center py-12 text-apple-gray-500 text-apple-body font-light">
                            No PIS timeslots available yet
                        </div>
                    ) : (
                        <>
                            <div className="flex gap-3 mb-6">
                                <button
                                    onClick={selectAll}
                                    className="px-4 py-2 bg-apple-gray-100 text-black rounded-apple-lg text-apple-footnote font-light hover:bg-apple-gray-200 transition-colors border border-apple-gray-200"
                                >
                                    Select All
                                </button>
                                <button
                                    onClick={clearAll}
                                    className="px-4 py-2 bg-white text-apple-gray-600 rounded-apple-lg text-apple-footnote font-light hover:bg-apple-gray-50 transition-colors border border-apple-gray-200"
                                >
                                    Clear All
                                </button>
                                <div className="ml-auto text-apple-caption1 text-apple-gray-500 self-center font-light">
                                    {selectedSlots.size} of {timeslots.length} selected
                                </div>
                            </div>

                            <div className="space-y-6">
                                {Object.entries(groupedSlots).map(([dateKey, slots]) => (
                                    <div key={dateKey}>
                                        <h3 className="text-apple-footnote font-medium text-black mb-3 border-b border-apple-gray-200 pb-2">
                                            {dateKey}
                                        </h3>
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                            {slots.map((slot, idx) => {
                                                const slotIso = timeslotIso(slot);
                                                const isSelected = selectedSlots.has(slotIso);
                                                const { time } = formatTimeslot(slot);

                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={() => toggleSlot(slotIso)}
                                                        className={`
                                                            px-3 py-2.5 rounded-apple-lg text-apple-footnote font-light
                                                            transition-all duration-150
                                                            ${isSelected
                                                                ? 'bg-black text-white shadow-md'
                                                                : 'bg-apple-gray-100 text-apple-gray-700 hover:bg-apple-gray-200 border border-apple-gray-200'
                                                            }
                                                        `}
                                                    >
                                                        {time}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="border-t border-apple-gray-200 bg-apple-gray-50 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <p className="text-apple-caption1 text-apple-gray-500 font-light">
                            You must submit this form to access the Rush App
                        </p>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className={`
                                px-6 py-2.5 rounded-apple-xl text-apple-body font-light text-white
                                transition-all duration-200
                                ${submitting
                                    ? 'bg-apple-gray-300 cursor-not-allowed'
                                    : 'bg-black hover:bg-apple-gray-800'
                                }
                            `}
                        >
                            {submitting ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Submitting...
                                </span>
                            ) : (
                                selectedSlots.size === 0
                                    ? 'Submit (Not Available)'
                                    : `Submit Availability (${selectedSlots.size} slots)`
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
