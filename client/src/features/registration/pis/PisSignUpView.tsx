import type { MouseEventHandler } from 'react';

import Loader from '../../../components/Loader';
import PisDayCard, { type PisSlot } from './PisDayCard';

export type PisSignUpViewProps = {
    error: boolean;
    loading: boolean;
    days: Map<string, PisSlot[]>;
    showMonday: boolean;
    setShowMonday: (show: boolean) => void;
    selectedSlot: PisSlot | null;
    flexWindow: boolean;
    setFlexWindow: (enabled: boolean) => void;
    handleSlotClick: (slot: PisSlot) => void;
    onContinue: MouseEventHandler<HTMLButtonElement>;
};

// Display PIS day cards, optional Monday slots, and the flexibility checkbox.
export default function PisSignUpView({
    error,
    loading,
    days,
    showMonday,
    setShowMonday,
    selectedSlot,
    flexWindow,
    setFlexWindow,
    handleSlotClick,
    onContinue,
}: PisSignUpViewProps) {
    return (
        <div className="w-screen min-h-screen bg-white flex flex-col justify-center items-center pt-16">
            {error ? (
                <div className="card-apple p-6 text-center">
                    <div className="flex items-center justify-center w-16 h-16 bg-apple-gray-100 rounded-apple-2xl border border-apple-gray-200 mb-4 mx-auto">
                        <svg className="w-8 h-8 text-apple-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h3 className="text-apple-title2 font-light text-black mb-2">Unable to Load Timeslots</h3>
                    <p className="text-apple-body text-apple-gray-600 font-light">Please try again later or contact support.</p>
                </div>
            ) : (
                <div>
                    {loading ? (
                        <Loader />
                    ) : (
                        <div className="text-center w-full p-8 max-w-7xl mx-auto mb-16">
                            <div className="mb-8">
                                <h1 className="mb-3 text-apple-large font-light text-black">
                                    Choose Your PIS Start Time
                                </h1>
                                <div className="w-16 h-0.5 bg-black mx-auto mb-4"></div>
                                <p className="text-apple-subheadline text-apple-gray-600 font-light max-w-2xl mx-auto">
                                    The PIS is an interview to get to know a little more about you outside of a rush setting
                                </p>
                            </div>

                            <div>
                                <div className="flex flex-wrap justify-center gap-6 max-w-7xl mx-auto">
                                    {[...days.entries()]
                                        .filter(
                                            /* Hide Monday unless the fallback has been requested. */
                                            ([day]) => new Date(day).getDay() !== 1 || showMonday)
                                        .map(/* Render a day’s available PIS timeslots. */ ([day, timeslots]) => (
                                            <PisDayCard
                                                key={day}
                                                day={day}
                                                timeslots={timeslots}
                                                selectedSlot={selectedSlot}
                                                onSelect={handleSlotClick}
                                            />
                                        ))}
                                </div>

                                {/* Monday stays hidden until the rushee requests the fallback. */}
                                {!showMonday &&
                                    [...days.entries()].some(
                                        /* Check whether any Monday timeslots exist. */ ([day]) => new Date(day).getDay() === 1
                                    ) && (
                                        <div className="mt-6 flex justify-center">
                                            <button
                                                onClick={/* Reveal the Monday fallback timeslots. */ () => setShowMonday(true)}
                                                className="py-3 px-6 rounded-apple-xl border border-apple-gray-300 text-apple-footnote font-medium text-black bg-white hover:bg-apple-gray-50 hover:border-apple-gray-400 active:scale-95 transition-all duration-200"
                                            >
                                                {"I can't attend Sunday — show Monday times"}
                                            </button>
                                        </div>
                                    )}
                            </div>
                            {selectedSlot && (
                                <div className="mt-8 flex justify-center">
                                    <div className="card-apple p-6 inline-block">
                                        <label className="flex items-start cursor-pointer group">
                                            <div className="relative flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={flexWindow}
                                                    onChange={
                                                        /* Update whether the selected start time may shift within the flex window. */
                                                        (e) => setFlexWindow(e.target.checked)}
                                                    className="sr-only"
                                                />
                                                <div className={`w-5 h-5 rounded-md border-2 transition-all duration-200 mr-4 flex items-center justify-center ${
                                                    flexWindow
                                                        ? "bg-black border-black"
                                                        : "bg-white border-apple-gray-300 group-hover:border-apple-gray-400"
                                                }`}>
                                                    {flexWindow && (
                                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-left">
                                                <p className="text-apple-body text-black font-medium">
                                                    Flex Window: I can shift my start time +/-30 minutes if needed
                                                </p>
                                                <p className="text-apple-caption1 text-apple-gray-600 font-light mt-1">
                                                    This helps with scheduling flexibility
                                                </p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            <div className="mt-8 flex flex-col items-center">
                                {selectedSlot && (
                                    <p className="text-apple-body text-apple-gray-600 font-light mb-4">
                                        Selected: <span className="font-medium text-black">{selectedSlot.time.toLocaleString()}</span>
                                    </p>
                                )}
                                <button
                                    onClick={onContinue}
                                    disabled={!selectedSlot}
                                    className={`px-8 py-4 text-apple-headline font-light rounded-apple-2xl transition-all duration-200 ${
                                        selectedSlot
                                            ? "btn-apple"
                                            : "bg-apple-gray-200 text-apple-gray-400 cursor-not-allowed"
                                    }`}
                                >
                                    Continue to Complete Registration
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
