import AccessToggleRow from './AccessToggleRow';

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

// Render controls for role access, comment visibility, and midterm mode.
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

                    <AccessToggleRow
                        label="Bid Committee"
                        description="Members with bid committee access"
                        enabled={rushAppStatus.disable_bidcom}
                        disabled={rushAppLoading}
                        onClick={
                            /* Toggle the bid committee access restriction. */
                            () => handleToggleRushAppAccess('disable_bidcom', !rushAppStatus.disable_bidcom)}
                    />

                    <AccessToggleRow
                        label="Regular Brothers"
                        description="Brothers without admin or bid committee"
                        enabled={rushAppStatus.disable_regular}
                        disabled={rushAppLoading}
                        onClick={
                            /* Toggle the regular-brother access restriction. */
                            () => handleToggleRushAppAccess('disable_regular', !rushAppStatus.disable_regular)}
                    />
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

                <AccessToggleRow
                    label="Show All Comments to Brothers"
                    description={commentVisibilityStatus.require_comment_to_view
                        ? 'Off — brothers only see their own comments (rush mode)'
                        : 'On — every brother can read all comments (voting mode)'}
                    enabled={!commentVisibilityStatus.require_comment_to_view}
                    disabled={commentVisibilityLoading}
                    onClick={
                        /* Toggle whether comment viewing is restricted. */
                        () => handleToggleCommentVisibility(!commentVisibilityStatus.require_comment_to_view)}
                />

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

                <AccessToggleRow
                    label="Midterm Mode"
                    description="Brothers see only the voting page"
                    enabled={rushAppStatus.midterm_mode}
                    disabled={midtermLoading}
                    onClick={/* Toggle midterm mode. */ () => handleToggleMidtermMode(!rushAppStatus.midterm_mode)}
                />

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
