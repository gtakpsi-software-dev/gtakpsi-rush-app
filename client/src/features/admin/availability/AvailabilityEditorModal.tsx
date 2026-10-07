type PisTimeslot = {
    time: { $date: { $numberLong: string } };
};

type AvailabilityEditorModalProps = {
    editingBrotherAvailability: {
        brother_first_name: string;
        brother_last_name: string;
    };
    allPisTimeslots: PisTimeslot[];
    groupedEditSlots: Record<string, PisTimeslot[]>;
    editingSlots: Set<string>;
    savingAvailability: boolean;
    formatSlotTime: (slot: PisTimeslot) => { date: string; time: string };
    onClose: () => void;
    onSelectAll: () => void;
    onClearAll: () => void;
    onToggleSlot: (slotIso: string) => void;
    onSave: () => void;
};

export default function AvailabilityEditorModal({
    editingBrotherAvailability,
    allPisTimeslots,
    groupedEditSlots,
    editingSlots,
    savingAvailability,
    formatSlotTime,
    onClose,
    onSelectAll,
    onClearAll,
    onToggleSlot,
    onSave,
}: AvailabilityEditorModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative bg-white rounded-apple-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden mx-4 border border-apple-gray-200">
                <div className="bg-black px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-apple-title2 font-normal text-white">
                            Edit Availability
                        </h2>
                        <p className="text-apple-footnote text-apple-gray-400 font-light">
                            {editingBrotherAvailability.brother_first_name} {editingBrotherAvailability.brother_last_name}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/60 hover:text-white text-2xl font-light transition-colors"
                    >
                        ×
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[55vh]">
                    {allPisTimeslots.length === 0 ? (
                        <div className="text-center py-8 text-apple-gray-500 text-apple-body font-light">
                            No PIS timeslots available
                        </div>
                    ) : (
                        <>
                            <div className="flex gap-3 mb-6">
                                <button
                                    onClick={onSelectAll}
                                    className="px-4 py-2 bg-apple-gray-100 text-black rounded-apple-lg text-apple-footnote font-light hover:bg-apple-gray-200 transition-colors border border-apple-gray-200"
                                >
                                    Select All
                                </button>
                                <button
                                    onClick={onClearAll}
                                    className="px-4 py-2 bg-white text-apple-gray-600 rounded-apple-lg text-apple-footnote font-light hover:bg-apple-gray-50 transition-colors border border-apple-gray-200"
                                >
                                    Clear All
                                </button>
                                <div className="ml-auto text-apple-caption1 text-apple-gray-500 self-center font-light">
                                    {editingSlots.size} of {allPisTimeslots.length} selected
                                </div>
                            </div>

                            <div className="space-y-6">
                                {Object.entries(groupedEditSlots).map(([dateKey, slots]) => (
                                    <div key={dateKey}>
                                        <h3 className="text-apple-footnote font-medium text-black mb-3 border-b border-apple-gray-200 pb-2">
                                            {dateKey}
                                        </h3>
                                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                            {slots.map((slot, idx) => {
                                                const slotIso = new Date(parseInt(slot.time.$date.$numberLong)).toISOString();
                                                const isSelected = editingSlots.has(slotIso);
                                                const { time } = formatSlotTime(slot);

                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={() => onToggleSlot(slotIso)}
                                                        className={`
                                                                    px-2 py-2 rounded-apple-lg text-apple-footnote font-light
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
                    <div className="flex items-center justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-apple-xl text-apple-body font-light text-apple-gray-600 hover:bg-apple-gray-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onSave}
                            disabled={savingAvailability}
                            className={`
                                        px-6 py-2.5 rounded-apple-xl text-apple-body font-light text-white
                                        transition-all duration-200
                                        ${savingAvailability
                                            ? 'bg-apple-gray-300 cursor-not-allowed'
                                            : 'bg-black hover:bg-apple-gray-800'
                                        }
                                    `}
                        >
                            {savingAvailability ? 'Saving...' : `Save (${editingSlots.size} slots)`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
