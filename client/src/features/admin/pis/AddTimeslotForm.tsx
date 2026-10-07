import { Link } from "react-router-dom";
import TimeslotInputs from "./TimeslotInputs";

type AddTimeslotFormProps = {
    timeslotTime: string;
    setTimeslotTime: (value: string) => void;
    timeslotChange: number;
    setTimeslotChange: (value: number) => void;
    result: string;
    isSubmitting: boolean;
    showSuccess: boolean;
    handleAddTimeslot: () => Promise<void>;
};

export default function AddTimeslotForm({
    timeslotTime,
    setTimeslotTime,
    timeslotChange,
    setTimeslotChange,
    result,
    isSubmitting,
    showSuccess,
    handleAddTimeslot,
}: AddTimeslotFormProps) {
    return (
        <div className="min-h-screen bg-gradient-to-r from-blue-50 to-orange-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-t-2xl shadow-lg p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-orange-500">
                                Add PIS Timeslot
                            </h1>
                            <p className="mt-2 text-gray-600">
                                Schedule interview slots for potential members
                            </p>
                        </div>
                        <Link
                            to="/admin"
                            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition duration-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Admin
                        </Link>
                    </div>
                </div>

                <div className="bg-white rounded-b-2xl shadow-lg p-8">
                    <TimeslotInputs
                        timeslotTime={timeslotTime}
                        setTimeslotTime={setTimeslotTime}
                        timeslotChange={timeslotChange}
                        setTimeslotChange={setTimeslotChange}
                    />

                    <div className="mt-8">
                        <button
                            onClick={handleAddTimeslot}
                            disabled={isSubmitting}
                            className={`w-full bg-gradient-to-r from-blue-600 to-orange-500
                                      hover:from-blue-700 hover:to-orange-600
                                      text-white text-lg font-semibold px-6 py-4 rounded-xl
                                      shadow-lg transform transition duration-200
                                      hover:scale-[1.02] focus:outline-none focus:ring-2
                                      focus:ring-offset-2 focus:ring-blue-500
                                      ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Creating Timeslot...
                                </span>
                            ) : (
                                'Create Interview Timeslot'
                            )}
                        </button>
                    </div>

                    {result && (
                        <div className="mt-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-700 mb-3">Status</h2>
                            <div className="bg-white rounded-lg p-4 font-mono text-sm shadow-inner">
                                {result}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showSuccess && (
                <div className="fixed bottom-8 right-8 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg animate-bounce">
                    <div className="flex items-center gap-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Timeslot Created Successfully!
                    </div>
                </div>
            )}
        </div>
    );
}
