import Loader from "../../components/Loader";
import Navbar from "../../components/Navbar";

type PisSlot = {
    time: Date;
    rushee_gtid: string;
    rushee_first_name: string;
    rushee_last_name: string;
    first_brother_first_name: string;
    first_brother_last_name: string;
    second_brother_first_name: string;
    second_brother_last_name: string;
};

type Props = {
    days: Map<string, PisSlot[]>;
    selectedSlot: string | null;
    loading: boolean;
    onSelect: (day: string, slot: PisSlot) => void;
    onSubmit: () => void;
};

export default function BrotherPisSlotSelectionView({
    days, selectedSlot, loading, onSelect, onSubmit,
}: Props) {
    return (
        <div>
            <Navbar />
            {loading ? <Loader /> : (
                <div className="w-screen min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center">
                    <div className="h-14" />
                    <div className="text-center w-full p-8">
                        <h1 className="mb-2 font-bold bg-gradient-to-r from-sky-700 via-amber-600 to-sky-700 animate-text bg-clip-text text-transparent text-4xl">
                            Choose Your PIS Timeslot
                        </h1>
                        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                            {Array.from(days.entries()).map(([day, timeslots]) => (
                                <div
                                    key={day}
                                    className="bg-gray-800 shadow-lg rounded-lg p-4"
                                >
                                    <h2 className="text-xl font-semibold text-center mb-4">
                                        {day}
                                    </h2>
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        {timeslots.map((slot, index) => {
                                            const slotKey = `${day}zz${slot.time.toISOString()}zz${slot.rushee_gtid}`;
                                            const isSelected = selectedSlot === slotKey;

                                            return (
                                                <div
                                                    key={index}
                                                    className={`py-2 px-4 rounded-lg transition transform cursor-pointer ${
                                                        isSelected
                                                            ? "bg-gradient-to-r from-teal-500 to-green-600 scale-105 shadow-lg"
                                                            : "bg-gradient-to-r from-sky-700 via-teal-600 to-amber-600 hover:scale-105 hover:shadow-lg"
                                                    }`}
                                                    onClick={() => onSelect(day, slot)}
                                                >
                                                    <p>
                                                        <strong>Time:</strong>{" "}
                                                        {slot.time.toLocaleTimeString([], {
                                                            hour: "numeric",
                                                            minute: "2-digit",
                                                            hour12: true,
                                                        })}
                                                    </p>
                                                    <p>
                                                        <strong>Rushee:</strong>{" "}
                                                        {slot.rushee_first_name}{" "}
                                                        {slot.rushee_last_name}
                                                    </p>
                                                    <p>
                                                        <strong>First Brother:</strong>{" "}
                                                        {slot.first_brother_first_name || "None"}{" "}
                                                        {slot.first_brother_last_name || "None"}
                                                    </p>
                                                    <p>
                                                        <strong>Second Brother:</strong>{" "}
                                                        {slot.second_brother_first_name || "None"}{" "}
                                                        {slot.second_brother_last_name || "None"}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={onSubmit}
                            className={`${selectedSlot ? "visible" : "invisible"} mt-6 py-3 px-6 text-lg font-bold rounded-lg transition bg-gradient-to-r from-amber-600 to-sky-700 hover:scale-105 hover:shadow-lg text-white`}
                        >
                            Submit Selected Slot
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
