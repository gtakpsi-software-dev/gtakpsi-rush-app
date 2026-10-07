import { format } from 'date-fns';

type TimeslotInputsProps = {
    timeslotTime: string;
    setTimeslotTime: (value: string) => void;
    timeslotChange: number;
    setTimeslotChange: (value: number) => void;
};

export default function TimeslotInputs({
    timeslotTime, setTimeslotTime, timeslotChange, setTimeslotChange,
}: TimeslotInputsProps) {
    const formatSelectedTime = (dateTimeStr: string) => {
        if (!dateTimeStr) return null;
        const date = new Date(dateTimeStr);
        return {
            date: format(date, 'MMMM d, yyyy'),
            time: format(date, 'h:mm a')
        };
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
                <div>
                    <label className="block text-lg font-semibold text-gray-700 mb-3">
                        📅 Select Date and Time
                    </label>
                    <input
                        type="datetime-local"
                        className="w-full px-4 py-3 text-lg border border-gray-300 rounded-xl
                                 focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                                 transition duration-200 bg-white shadow-sm
                                 hover:border-blue-400"
                        value={timeslotTime}
                        onChange={(e) => setTimeslotTime(e.target.value)}
                    />
                    {timeslotTime && (
                        <div className="mt-4 bg-blue-50 rounded-xl p-4 border-2 border-blue-100">
                            <div className="flex items-center gap-3">
                                <div className="bg-white p-3 rounded-lg shadow-sm text-center min-w-[80px]">
                                    <div className="text-blue-600 text-sm font-semibold">
                                        {formatSelectedTime(timeslotTime)!.date}
                                    </div>
                                    <div className="text-orange-500 font-bold mt-1">
                                        {formatSelectedTime(timeslotTime)!.time}
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm text-gray-600">
                                        {timeslotChange} {timeslotChange === 1 ? 'slot' : 'slots'} will be created
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-lg font-semibold text-gray-700 mb-3">
                        👥 Number of Interview Slots
                    </label>
                    <input
                        type="number"
                        min="1"
                        className="w-full px-4 py-3 text-lg border border-gray-300 rounded-xl
                                 focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                                 transition duration-200 bg-white shadow-sm
                                 hover:border-blue-400"
                        value={timeslotChange}
                        onChange={(e) => setTimeslotChange(Number(e.target.value))}
                    />
                </div>
            </div>
        </div>
    );
}
