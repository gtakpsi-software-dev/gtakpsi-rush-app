import type { ComponentProps } from 'react';

import AdminDataActions from '../data/AdminDataActions';
import AdminAccessCard from '../access/AdminAccessCard';
import AccessSettingsCards from '../access/AccessSettingsCards';

type AdminExportsAccessSectionProps =
    ComponentProps<typeof AdminDataActions> &
    ComponentProps<typeof AdminAccessCard> &
    ComponentProps<typeof AccessSettingsCards>;

// Group export controls, role management, and app-access settings.
export default function AdminExportsAccessSection(props: AdminExportsAccessSectionProps) {
    const {
        exportRusheeNumbers, exportPISSchedule, exportRusheePersonalInfo, handleRequest,
        brotherSearch, setBrotherSearch, selectedBrother, setSelectedBrother,
        filteredBrothers, handleSelectBrother, brotherAdminStatus, brotherBidcomStatus,
        isPromoting, handleSetAdmin, handleSetBidcom, rushAppStatus,
        rushAppLoading, handleToggleRushAppAccess, commentVisibilityStatus, commentVisibilityLoading,
        handleToggleCommentVisibility, midtermLoading, handleToggleMidtermMode,
    } = props;

    return (
        <div className="mb-10">
            <h2 className="text-apple-title2 font-normal text-black mb-4">Exports & Data</h2>

            <div className="grid gap-4 md:grid-cols-2">
                <AdminDataActions
                    exportRusheeNumbers={exportRusheeNumbers}
                    exportPISSchedule={exportPISSchedule}
                    exportRusheePersonalInfo={exportRusheePersonalInfo}
                    handleRequest={handleRequest}
                />

                <AdminAccessCard
                    brotherSearch={brotherSearch}
                    setBrotherSearch={setBrotherSearch}
                    selectedBrother={selectedBrother}
                    setSelectedBrother={setSelectedBrother}
                    filteredBrothers={filteredBrothers}
                    handleSelectBrother={handleSelectBrother}
                    brotherAdminStatus={brotherAdminStatus}
                    brotherBidcomStatus={brotherBidcomStatus}
                    isPromoting={isPromoting}
                    handleSetAdmin={handleSetAdmin}
                    handleSetBidcom={handleSetBidcom}
                />

                <AccessSettingsCards
                    rushAppStatus={rushAppStatus}
                    rushAppLoading={rushAppLoading}
                    handleToggleRushAppAccess={handleToggleRushAppAccess}
                    commentVisibilityStatus={commentVisibilityStatus}
                    commentVisibilityLoading={commentVisibilityLoading}
                    handleToggleCommentVisibility={handleToggleCommentVisibility}
                    midtermLoading={midtermLoading}
                    handleToggleMidtermMode={handleToggleMidtermMode}
                />
            </div>
        </div>
    );
}
