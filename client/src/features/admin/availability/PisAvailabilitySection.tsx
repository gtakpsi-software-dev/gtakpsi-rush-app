import PisAvailabilityFormCard, { type PisFormStatus } from "./PisAvailabilityFormCard";
import PisAvailabilitySubmissionsCard, {
    type BrotherAvailability,
} from "./PisAvailabilitySubmissionsCard";

type PisAvailabilitySectionProps = {
    pisFormStatus: PisFormStatus;
    pisFormLoading: boolean;
    brotherAvailabilities: BrotherAvailability[];
    handleSendPISForm: () => Promise<void>;
    handleDeactivatePISForm: () => Promise<void>;
    handleClearAndResendPISForm: () => Promise<void>;
    openEditAvailability: (brother: BrotherAvailability) => void;
    handleAutoAssignBrothers: () => Promise<void>;
    handleClearAssignments: () => Promise<void>;
    exportPISWithBrothers: () => Promise<void>;
};

export default function PisAvailabilitySection({
    pisFormStatus,
    pisFormLoading,
    brotherAvailabilities,
    handleSendPISForm,
    handleDeactivatePISForm,
    handleClearAndResendPISForm,
    openEditAvailability,
    handleAutoAssignBrothers,
    handleClearAssignments,
    exportPISWithBrothers,
}: PisAvailabilitySectionProps) {
    return (
        <div>
            <h2 className="text-apple-title2 font-normal text-black mb-4">PIS Brother Availability</h2>
            <p className="text-apple-footnote text-apple-gray-600 font-light mb-6">
                Send availability form to brothers, auto-assign them to PIS slots, and export schedules
            </p>

            <div className="space-y-6">
                <PisAvailabilityFormCard
                    pisFormStatus={pisFormStatus}
                    pisFormLoading={pisFormLoading}
                    onSendPISForm={handleSendPISForm}
                    onDeactivatePISForm={handleDeactivatePISForm}
                    onClearAndResendPISForm={handleClearAndResendPISForm}
                />

                <PisAvailabilitySubmissionsCard
                    brotherAvailabilities={brotherAvailabilities}
                    onEditAvailability={openEditAvailability}
                />

                <div className="card-apple p-6">
                    <h3 className="text-apple-headline font-normal text-black mb-2">Auto-Assign Brothers</h3>
                    <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                        Automatically assign 2 available brothers to each rushee&apos;s PIS slot based on submitted availability.
                        Brothers are load-balanced to distribute assignments evenly.
                    </p>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={handleAutoAssignBrothers}
                            disabled={pisFormLoading || brotherAvailabilities.length === 0}
                            className={`flex-1 py-3 px-4 rounded-apple-xl text-apple-body font-light transition-all duration-200 ${
                                brotherAvailabilities.length > 0
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            } disabled:opacity-60`}
                        >
                            {pisFormLoading ? '...' : 'Auto-Assign Brothers'}
                        </button>
                        <button
                            onClick={handleClearAssignments}
                            disabled={pisFormLoading}
                            className="flex-1 bg-white text-red-600 py-3 px-4 rounded-apple-xl text-apple-body font-light border border-red-200 hover:bg-red-50 transition-all duration-200 disabled:opacity-60"
                        >
                            {pisFormLoading ? '...' : 'Clear All Assignments'}
                        </button>
                    </div>
                </div>

                <div className="card-apple p-6">
                    <h3 className="text-apple-headline font-normal text-black mb-2">Export Full Schedule</h3>
                    <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                        Export CSV with rushee names, timeslots, and assigned brothers (sorted chronologically)
                    </p>
                    <button
                        onClick={exportPISWithBrothers}
                        className="w-full bg-black text-white py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-800 transition-all duration-200"
                    >
                        Export PIS Schedule with Brothers
                    </button>
                </div>
            </div>
        </div>
    );
}
