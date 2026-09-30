type BrotherAvailability = {
    brother_first_name: string;
    brother_last_name: string;
    available_timeslots?: unknown[];
};

type ExtendedDate = { $date: { $numberLong: string } };

type PisAvailabilitySectionProps = {
    pisFormStatus: { is_active: boolean; sent_at: string | ExtendedDate | null };
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

function formatSentAt(sentAt: string | ExtendedDate) {
    // The API sends this timestamp as either extended JSON or an ISO string.
    const value = (sentAt as ExtendedDate).$date
        ? parseInt((sentAt as ExtendedDate).$date.$numberLong)
        : sentAt;
    return new Date(value as string | number).toLocaleString();
}

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
                <div className="card-apple p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-apple-headline font-normal text-black">Availability Form</h3>
                        <div className={`px-3 py-1 rounded-full text-apple-caption1 font-medium ${
                            pisFormStatus.is_active
                                ? 'bg-black text-white'
                                : 'bg-apple-gray-100 text-apple-gray-600'
                        }`}>
                            {pisFormStatus.is_active ? 'Active' : 'Inactive'}
                        </div>
                    </div>

                    {pisFormStatus.sent_at && (
                        <p className="text-apple-caption2 text-apple-gray-500 mb-4">
                            Last sent: {formatSentAt(pisFormStatus.sent_at)}
                        </p>
                    )}

                    <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                        When active, brothers will be prompted to fill out their availability before accessing the app.
                    </p>

                    <div className="flex flex-wrap gap-3">
                        {!pisFormStatus.is_active ? (
                            <button
                                onClick={handleSendPISForm}
                                disabled={pisFormLoading}
                                className="flex-1 bg-black text-white py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-800 transition-all duration-200 disabled:opacity-60"
                            >
                                {pisFormLoading ? 'Sending...' : 'Send Form to All Brothers'}
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleDeactivatePISForm}
                                    disabled={pisFormLoading}
                                    className="flex-1 bg-apple-gray-100 text-apple-gray-700 py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-200 transition-all duration-200 disabled:opacity-60 border border-apple-gray-200"
                                >
                                    {pisFormLoading ? '...' : 'Deactivate Form'}
                                </button>
                                <button
                                    onClick={handleClearAndResendPISForm}
                                    disabled={pisFormLoading}
                                    className="flex-1 bg-white text-red-600 py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-red-50 transition-all duration-200 disabled:opacity-60 border border-red-200"
                                >
                                    {pisFormLoading ? '...' : 'Clear & Resend'}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="card-apple p-6">
                    <h3 className="text-apple-headline font-normal text-black mb-2">Submissions</h3>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="text-3xl font-light text-black">
                            {brotherAvailabilities.length}
                        </div>
                        <div className="text-apple-footnote text-apple-gray-600 font-light">
                            brothers have submitted their availability
                        </div>
                    </div>

                    <p className="text-apple-caption2 text-apple-gray-500 mb-3 font-light">
                        Click on a name to edit their availability
                    </p>

                    {brotherAvailabilities.length > 0 && (
                        <div className="bg-apple-gray-50 rounded-apple-lg p-3 max-h-48 overflow-y-auto border border-apple-gray-100">
                            <div className="flex flex-wrap gap-2">
                                {brotherAvailabilities.map((avail, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => openEditAvailability(avail)}
                                        className="text-apple-caption1 bg-white px-3 py-1.5 rounded-apple border border-apple-gray-200 text-apple-gray-700 hover:bg-apple-gray-100 hover:border-apple-gray-300 transition-all cursor-pointer font-light"
                                    >
                                        {avail.brother_first_name} {avail.brother_last_name}
                                        <span className="ml-1 text-apple-gray-400">
                                            ({avail.available_timeslots?.length || 0})
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="card-apple p-6">
                    <h3 className="text-apple-headline font-normal text-black mb-2">Auto-Assign Brothers</h3>
                    <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                        Automatically assign 2 available brothers to each rushee's PIS slot based on submitted availability.
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
