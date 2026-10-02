import Navbar from '../../components/Navbar';
import QuestionDisplay from './QuestionDisplay';
import RusheePreviewCard from './RusheePreviewCard';
import RusheeComments from './RusheeComments';
import VoteSummary from './VoteSummary';
import BrotherList from './BrotherList';
import type { ConnectionStatus } from '../../features/voting/admin/types';

export default function AdminVotingDashboardView({ connectionStatus }: { connectionStatus: ConnectionStatus }) {
    return (
        <div className="w-screen h-screen flex overflow-visible">
            <Navbar />
            {connectionStatus === 'disconnected' && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-red-100 text-red-700 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Connection lost. Reconnecting...</span>
                </div>
            )}
            {connectionStatus === 'connecting' && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Connecting...</span>
                </div>
            )}
            <div className="w-[65%] h-full pt-24 bg-white border-r border-apple-gray-200 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-8 py-6 pb-24">
                    <div className="flex flex-col space-y-6">
                        <QuestionDisplay />
                        <RusheePreviewCard />
                        <RusheeComments />
                    </div>
                </div>
            </div>
            <div className="w-[35%] h-full pt-24 bg-white border-r border-apple-gray-200 overflow-y-auto">
                <div className="px-6 py-6 pb-24">
                    <VoteSummary showBreakdown={true} />
                    <BrotherList/>
                </div>
            </div>
        </div>
    );
}
