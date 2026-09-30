type AdminDataActionsProps = {
    exportRusheeNumbers: () => Promise<void>;
    exportPISSchedule: () => Promise<void>;
    exportRusheePersonalInfo: () => Promise<void>;
    handleRequest: (endpoint: string, body: object, method: string, message: string) => Promise<void>;
};

export default function AdminDataActions({
    exportRusheeNumbers,
    exportPISSchedule,
    exportRusheePersonalInfo,
    handleRequest,
}: AdminDataActionsProps) {
    return (
        <>
            <div className="card-apple p-5">
                <h3 className="text-apple-headline font-normal text-black mb-2">Rushee Numbers</h3>
                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                    Export CSV with rushee numbers (001, 002...) mapped to names
                </p>
                <button
                    onClick={exportRusheeNumbers}
                    className="w-full bg-black text-white py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-800 transition-all duration-200"
                >
                    Export Rushee Numbers
                </button>
            </div>

            <div className="card-apple p-5">
                <h3 className="text-apple-headline font-normal text-black mb-2">PIS Schedule</h3>
                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                    Export CSV with all PIS appointments
                </p>
                <button
                    onClick={exportPISSchedule}
                    className="w-full bg-black text-white py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-800 transition-all duration-200"
                >
                    Export PIS Schedule
                </button>
            </div>

            <div className="card-apple p-5">
                <h3 className="text-apple-headline font-normal text-black mb-2">Rushee Personal Info</h3>
                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                    Export CSV with all registration info (name, GTID, email, phone, housing, major, etc.)
                </p>
                <button
                    onClick={exportRusheePersonalInfo}
                    className="w-full bg-black text-white py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-800 transition-all duration-200"
                >
                    Export Rushee Info
                </button>
            </div>

            <div className="card-apple p-5">
                <h3 className="text-apple-headline font-normal text-black mb-2">PIS Questions</h3>
                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                    View all current PIS questions in console
                </p>
                <button
                    onClick={() => handleRequest("get_pis_questions", {}, "get", "Check console for questions")}
                    className="w-full bg-apple-gray-100 text-black py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-200 transition-all duration-200 border border-apple-gray-200"
                >
                    Fetch Questions
                </button>
            </div>

            <div className="card-apple p-5">
                <h3 className="text-apple-headline font-normal text-black mb-2">PIS Timeslots</h3>
                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                    View all current PIS timeslots in console
                </p>
                <button
                    onClick={() => handleRequest("get_pis_timeslots", {}, "get", "Check console for timeslots")}
                    className="w-full bg-apple-gray-100 text-black py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-200 transition-all duration-200 border border-apple-gray-200"
                >
                    Fetch Timeslots
                </button>
            </div>
        </>
    );
}
