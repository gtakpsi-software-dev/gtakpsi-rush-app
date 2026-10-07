type Rushee = {
    gtid: string;
    name: string;
};

type PisTimeslot = {
    time: { $date: { $numberLong: string } };
    capacity: number;
};

type ReschedulePisCardProps = {
    rusheeSearch: string;
    setRusheeSearch: (value: string) => void;
    selectedRushee: Rushee | null;
    setSelectedRushee: (rushee: Rushee | null) => void;
    filteredRushees: Rushee[];
    handleSelectRushee: (rushee: Rushee) => void;
    formatCurrentPISTime: (rushee: Rushee) => string;
    selectedNewTimeslot: string;
    setSelectedNewTimeslot: (value: string) => void;
    availableTimeslots: PisTimeslot[];
    formatTimeslot: (slot: PisTimeslot) => string;
    handleReschedulePIS: () => Promise<void>;
};

export default function ReschedulePisCard({
    rusheeSearch,
    setRusheeSearch,
    selectedRushee,
    setSelectedRushee,
    filteredRushees,
    handleSelectRushee,
    formatCurrentPISTime,
    selectedNewTimeslot,
    setSelectedNewTimeslot,
    availableTimeslots,
    formatTimeslot,
    handleReschedulePIS,
}: ReschedulePisCardProps) {
    return (
        <div className="card-apple p-6">
            <h3 className="text-apple-headline font-normal text-black mb-4">Reschedule PIS</h3>
            <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                Search for a rushee and reassign their PIS timeslot
            </p>

            <div className="space-y-4">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search rushee by name or GTID..."
                        className="input-apple text-apple-body"
                        value={rusheeSearch}
                        onChange={(e) => {
                            setRusheeSearch(e.target.value);
                            if (selectedRushee && e.target.value !== selectedRushee.name) {
                                setSelectedRushee(null);
                            }
                        }}
                    />

                    {filteredRushees.length > 0 && !selectedRushee && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-apple-gray-200 rounded-apple-lg shadow-lg max-h-60 overflow-y-auto">
                            {filteredRushees.map((rushee) => (
                                <div
                                    key={rushee.gtid}
                                    className="px-4 py-3 hover:bg-apple-gray-100 cursor-pointer border-b border-apple-gray-100 last:border-b-0"
                                    onClick={() => handleSelectRushee(rushee)}
                                >
                                    <div className="text-apple-body font-normal text-black">
                                        {rushee.name}
                                    </div>
                                    <div className="text-apple-caption2 text-apple-gray-600">
                                        GTID: {rushee.gtid}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {selectedRushee && (
                    <div className="bg-apple-gray-50 rounded-apple-lg p-4 border border-apple-gray-200">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="text-apple-body font-medium text-black">
                                    {selectedRushee.name}
                                </div>
                                <div className="text-apple-caption2 text-apple-gray-600 mt-1">
                                    GTID: {selectedRushee.gtid}
                                </div>
                                <div className="text-apple-caption2 text-apple-gray-600 mt-1">
                                    Current PIS: <span className="font-medium">{formatCurrentPISTime(selectedRushee)}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedRushee(null);
                                    setRusheeSearch("");
                                }}
                                className="text-apple-gray-400 hover:text-apple-gray-600 text-xl"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                )}

                <div>
                    <label className="text-apple-footnote text-apple-gray-600 font-light mb-2 block">
                        Select New Timeslot
                    </label>
                    <select
                        className="input-apple text-apple-body"
                        value={selectedNewTimeslot}
                        onChange={(e) => setSelectedNewTimeslot(e.target.value)}
                        disabled={!selectedRushee}
                    >
                        <option value="">Choose a timeslot...</option>
                        {availableTimeslots.map((slot, index) => (
                            <option
                                key={index}
                                value={new Date(parseInt(slot.time.$date.$numberLong)).toISOString()}
                            >
                                {formatTimeslot(slot)} ({slot.capacity} spot{slot.capacity !== 1 ? 's' : ''} available)
                            </option>
                        ))}
                    </select>
                    {availableTimeslots.length === 0 && (
                        <p className="text-apple-caption2 text-apple-gray-500 mt-2">
                            No available timeslots found
                        </p>
                    )}
                </div>

                <button
                    onClick={handleReschedulePIS}
                    disabled={!selectedRushee || !selectedNewTimeslot}
                    className={`w-full py-3 px-4 rounded-apple-xl text-apple-body font-light transition-all duration-200 ${
                        selectedRushee && selectedNewTimeslot
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-apple-gray-200 text-apple-gray-400 cursor-not-allowed'
                    }`}
                >
                    Reschedule PIS
                </button>
            </div>
        </div>
    );
}
