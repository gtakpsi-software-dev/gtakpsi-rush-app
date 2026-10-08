type ExtendedDate = { $date: { $numberLong: string } };

export type PisFormStatus = {
    is_active: boolean;
    sent_at: string | ExtendedDate | null;
};

type PisAvailabilityFormCardProps = {
    pisFormStatus: PisFormStatus;
    pisFormLoading: boolean;
    onSendPISForm: () => Promise<void>;
    onDeactivatePISForm: () => Promise<void>;
    onClearAndResendPISForm: () => Promise<void>;
};

// Format the form’s BSON or plain sent timestamp in local time.
function formatSentAt(sentAt: string | ExtendedDate) {
    // The API sends this timestamp as either extended JSON or an ISO string.
    const value = (sentAt as ExtendedDate).$date
        ? parseInt((sentAt as ExtendedDate).$date.$numberLong)
        : sentAt;
    return new Date(value as string | number).toLocaleString();
}

// Display availability form status and activation, deactivation, or reset controls.
export default function PisAvailabilityFormCard({
    pisFormStatus,
    pisFormLoading,
    onSendPISForm,
    onDeactivatePISForm,
    onClearAndResendPISForm,
}: PisAvailabilityFormCardProps) {
    return (
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
                        onClick={onSendPISForm}
                        disabled={pisFormLoading}
                        className="flex-1 bg-black text-white py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-800 transition-all duration-200 disabled:opacity-60"
                    >
                        {pisFormLoading ? 'Sending...' : 'Send Form to All Brothers'}
                    </button>
                ) : (
                    <>
                        <button
                            onClick={onDeactivatePISForm}
                            disabled={pisFormLoading}
                            className="flex-1 bg-apple-gray-100 text-apple-gray-700 py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-200 transition-all duration-200 disabled:opacity-60 border border-apple-gray-200"
                        >
                            {pisFormLoading ? '...' : 'Deactivate Form'}
                        </button>
                        <button
                            onClick={onClearAndResendPISForm}
                            disabled={pisFormLoading}
                            className="flex-1 bg-white text-red-600 py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-red-50 transition-all duration-200 disabled:opacity-60 border border-red-200"
                        >
                            {pisFormLoading ? '...' : 'Clear & Resend'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
