import type { ComponentProps } from "react";

import Navbar from "../../components/Navbar";
import PisProfileHeader from "./PisProfileHeader";
import PisQuestionsCard from "./PisQuestionsCard";

type Props = ComponentProps<typeof PisQuestionsCard> & ComponentProps<typeof PisProfileHeader> & {
    collaboration: ComponentProps<typeof PisQuestionsCard>["collaboration"] & {
        connectedUsers: unknown[];
    };
};

export default function PisInterviewView(props: Props) {
    const { collaboration, rushee } = props;

    return (
        <div className="min-h-screen w-full bg-white overflow-y-auto">
            <Navbar />

            <div className="pt-24 p-4 pb-20">
                <div className="container mx-auto px-4 max-w-4xl">
                    {collaboration.isConnected && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-apple">
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-sm text-green-800">
                                    {collaboration.connectedUsers.length} other user{collaboration.connectedUsers.length === 1 ? '' : 's'} online
                                </span>
                            </div>
                        </div>
                    )}

                    <PisProfileHeader rushee={rushee} />

                    <PisQuestionsCard {...props} />
                </div>
            </div>
        </div>
    );
}
