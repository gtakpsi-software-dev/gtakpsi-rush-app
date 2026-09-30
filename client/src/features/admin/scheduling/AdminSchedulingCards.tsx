type AdminSchedulingCardsProps = {
    timeslotTime: string;
    setTimeslotTime: (value: string) => void;
    timeslotChange: number;
    setTimeslotChange: (value: number) => void;
    rushNightName: string;
    setRushNightName: (value: string) => void;
    rushNightTime: string;
    setRushNightTime: (value: string) => void;
    handleRequest: (endpoint: string, body: object, method: string, message: string) => Promise<void>;
};

export default function AdminSchedulingCards({
    timeslotTime,
    setTimeslotTime,
    timeslotChange,
    setTimeslotChange,
    rushNightName,
    setRushNightName,
    rushNightTime,
    setRushNightTime,
    handleRequest,
}: AdminSchedulingCardsProps) {
    return (
        <>
            <div className="card-apple p-6">
                <h3 className="text-apple-headline font-normal text-black mb-4">PIS Timeslots</h3>
                <div className="space-y-3 mb-4">
                    <input
                        type="datetime-local"
                        className="input-apple text-apple-body"
                        value={timeslotTime}
                        onChange={(e) => setTimeslotTime(e.target.value)}
                    />
                    <input
                        type="number"
                        placeholder="Number of slots"
                        className="input-apple text-apple-body"
                        value={timeslotChange}
                        onChange={(e) => setTimeslotChange(Number(e.target.value))}
                    />
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => handleRequest("add_pis_timeslot", { time: timeslotTime, change: timeslotChange }, "post", "Timeslot added!")}
                        className="flex-1 bg-black text-white py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-800 transition-all duration-200"
                    >
                        Add Timeslot
                    </button>
                    <button
                        onClick={() => handleRequest("delete_pis_timeslot", { time: timeslotTime, change: timeslotChange }, "post", "Timeslot deleted!")}
                        className="flex-1 bg-white text-red-600 py-3 px-4 rounded-apple-xl text-apple-body font-light border border-red-200 hover:bg-red-50 transition-all duration-200"
                    >
                        Delete Timeslot
                    </button>
                </div>
            </div>

            <div className="card-apple p-6">
                <h3 className="text-apple-headline font-normal text-black mb-4">Rush Nights</h3>
                <div className="space-y-3 mb-4">
                    <input
                        type="text"
                        placeholder="Rush night name"
                        className="input-apple text-apple-body"
                        value={rushNightName}
                        onChange={(e) => setRushNightName(e.target.value)}
                    />
                    <input
                        type="datetime-local"
                        className="input-apple text-apple-body"
                        value={rushNightTime}
                        onChange={(e) => setRushNightTime(e.target.value)}
                    />
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => handleRequest("add-rush-night", { name: rushNightName, time: rushNightTime }, "post", "Rush night added!")}
                        className="flex-1 bg-black text-white py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-800 transition-all duration-200"
                    >
                        Add Rush Night
                    </button>
                    <button
                        onClick={() => handleRequest("delete_rush_night", { time: rushNightTime }, "post", "Rush night deleted!")}
                        className="flex-1 bg-white text-red-600 py-3 px-4 rounded-apple-xl text-apple-body font-light border border-red-200 hover:bg-red-50 transition-all duration-200"
                    >
                        Delete Rush Night
                    </button>
                </div>
            </div>
        </>
    );
}
