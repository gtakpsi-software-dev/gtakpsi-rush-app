import { SAVE_STATUS } from "./saveStatus";

type Props = { saveStatus: string; lastSaved: Date | null };

export default function PisSaveStatus({ saveStatus, lastSaved }: Props) {
    switch (saveStatus) {
        case SAVE_STATUS.SAVING:
            return (
                <div className="flex items-center space-x-2 text-apple-gray-600">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                    <span className="text-sm">Saving...</span>
                </div>
            );
        case SAVE_STATUS.SAVED:
            return (
                <div className="flex items-center space-x-2 text-green-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm">All changes saved</span>
                </div>
            );
        case SAVE_STATUS.ERROR:
            return (
                <div className="flex items-center space-x-2 text-red-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-sm">Error saving</span>
                </div>
            );
        default:
            return lastSaved ? (
                <div className="flex items-center space-x-2 text-apple-gray-500">
                    <span className="text-sm">Last saved {lastSaved.toLocaleTimeString()}</span>
                </div>
            ) : null;
    }
}
