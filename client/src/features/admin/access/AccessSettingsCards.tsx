type AccessSettingsCardsProps = {
    rushAppStatus: {
        disable_bidcom: boolean;
        disable_regular: boolean;
        midterm_mode: boolean;
    };
    rushAppLoading: boolean;
    handleToggleRushAppAccess: (field: "disable_bidcom" | "disable_regular", newValue: boolean) => Promise<void>;
    commentVisibilityStatus: { require_comment_to_view: boolean };
    commentVisibilityLoading: boolean;
    handleToggleCommentVisibility: (newValue: boolean) => Promise<void>;
    midtermLoading: boolean;
    handleToggleMidtermMode: (newValue: boolean) => Promise<void>;
};

export default function AccessSettingsCards({
    rushAppStatus,
    rushAppLoading,
    handleToggleRushAppAccess,
    commentVisibilityStatus,
    commentVisibilityLoading,
    handleToggleCommentVisibility,
    midtermLoading,
    handleToggleMidtermMode,
}: AccessSettingsCardsProps) {
    return (
        <>
            <div className="card-apple p-5">
                <h3 className="text-apple-headline font-normal text-black mb-2">Rush App Access</h3>
                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                    Disable login for specific groups. Admins always have access.
                </p>

                <div className="space-y-4">

                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-apple-body font-normal text-black">Bid Committee</div>
                            <div className="text-apple-caption2 text-apple-gray-500">Members with bid committee access</div>
                        </div>
                        <button
                            onClick={() => handleToggleRushAppAccess('disable_bidcom', !rushAppStatus.disable_bidcom)}
                            disabled={rushAppLoading}
                            className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                                rushAppStatus.disable_bidcom ? 'bg-black' : 'bg-apple-gray-300'
                            } ${rushAppLoading ? 'opacity-50' : ''}`}
                        >
                            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                                rushAppStatus.disable_bidcom ? 'translate-x-5' : 'translate-x-0.5'
                            }`} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-apple-body font-normal text-black">Regular Brothers</div>
                            <div className="text-apple-caption2 text-apple-gray-500">Brothers without admin or bid committee</div>
                        </div>
                        <button
                            onClick={() => handleToggleRushAppAccess('disable_regular', !rushAppStatus.disable_regular)}
                            disabled={rushAppLoading}
                            className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                                rushAppStatus.disable_regular ? 'bg-black' : 'bg-apple-gray-300'
                            } ${rushAppLoading ? 'opacity-50' : ''}`}
                        >
                            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                                rushAppStatus.disable_regular ? 'translate-x-5' : 'translate-x-0.5'
                            }`} />
                        </button>
                    </div>
                </div>

                <div className="mt-4 pt-3 border-t border-apple-gray-100">
                    <div className="text-apple-caption2 text-apple-gray-400">
                        {(rushAppStatus.disable_bidcom || rushAppStatus.disable_regular)
                            ? `Disabled: ${[
                                rushAppStatus.disable_bidcom && 'Bid Committee',
                                rushAppStatus.disable_regular && 'Regular Brothers'
                            ].filter(Boolean).join(', ')}`
                            : 'All brothers can access the app'
                        }
                    </div>
                </div>
            </div>

            <div className="card-apple p-5">
                <h3 className="text-apple-headline font-normal text-black mb-2">Comment Visibility</h3>
                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                    Control whether brothers can read every comment on a rushee, or only their own.
                    Turn this on before voting so brothers can read all comments even if they did not post one.
                </p>

                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-apple-body font-normal text-black">Show All Comments to Brothers</div>
                        <div className="text-apple-caption2 text-apple-gray-500">
                            {commentVisibilityStatus.require_comment_to_view
                                ? 'Off — brothers only see their own comments (rush mode)'
                                : 'On — every brother can read all comments (voting mode)'
                            }
                        </div>
                    </div>
                    <button
                        onClick={() => handleToggleCommentVisibility(!commentVisibilityStatus.require_comment_to_view)}
                        disabled={commentVisibilityLoading}
                        className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                            !commentVisibilityStatus.require_comment_to_view ? 'bg-black' : 'bg-apple-gray-300'
                        } ${commentVisibilityLoading ? 'opacity-50' : ''}`}
                    >
                        <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                            !commentVisibilityStatus.require_comment_to_view ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                    </button>
                </div>

                <div className="mt-4 pt-3 border-t border-apple-gray-100">
                    <div className="text-apple-caption2 text-apple-gray-400">
                        {commentVisibilityStatus.require_comment_to_view
                            ? 'Rush mode — brothers only see their own comments'
                            : 'Voting mode — all brothers can see all comments without posting'
                        }
                    </div>
                </div>
            </div>

            <div className="card-apple p-5">
                <h3 className="text-apple-headline font-normal text-black mb-2">Midterm Mode</h3>
                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                    Strips the app to voting-only for all brothers. Admins retain full access. The navbar title changes to &quot;AKPsi Midterm&quot; and the contact bar is hidden.
                </p>

                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-apple-body font-normal text-black">Midterm Mode</div>
                        <div className="text-apple-caption2 text-apple-gray-500">Brothers see only the voting page</div>
                    </div>
                    <button
                        onClick={() => handleToggleMidtermMode(!rushAppStatus.midterm_mode)}
                        disabled={midtermLoading}
                        className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                            rushAppStatus.midterm_mode ? 'bg-black' : 'bg-apple-gray-300'
                        } ${midtermLoading ? 'opacity-50' : ''}`}
                    >
                        <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                            rushAppStatus.midterm_mode ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                    </button>
                </div>

                <div className="mt-4 pt-3 border-t border-apple-gray-100">
                    <div className="text-apple-caption2 text-apple-gray-400">
                        {rushAppStatus.midterm_mode
                            ? 'Midterm Mode is active — brothers see voting only'
                            : 'Normal mode — full app is available to brothers'
                        }
                    </div>
                </div>
            </div>
        </>
    );
}
