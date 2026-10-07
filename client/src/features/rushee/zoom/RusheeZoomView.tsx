import type { ComponentProps } from "react";

import Navbar from "../../../components/Navbar";
import RusheeActions from "./RusheeActions";
import RusheeCommentsView from "./RusheeCommentsView";
import RusheePisDetails from "./RusheePisDetails";
import RusheeProfileHeader from "./RusheeProfileHeader";
import RusheeRatings from "./RusheeRatings";
import ZoomModals from "./ZoomModals";

type Props = {
    modals: ComponentProps<typeof ZoomModals>;
    profile: ComponentProps<typeof RusheeProfileHeader>;
    actions: ComponentProps<typeof RusheeActions>;
    ratings: ComponentProps<typeof RusheeRatings>;
    pisDetails: ComponentProps<typeof RusheePisDetails>;
    comments: ComponentProps<typeof RusheeCommentsView>;
    isBidCommitteeMode: () => boolean;
};

export default function RusheeZoomView({
    modals,
    profile,
    actions,
    ratings,
    pisDetails,
    comments,
    isBidCommitteeMode,
}: Props) {
    return (
        <div>
            <div className="min-h-screen w-full bg-white">
                <ZoomModals {...modals} />

                <Navbar />

                <div className="pt-24 p-4 pb-20">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <RusheeProfileHeader {...profile} />

                        {!isBidCommitteeMode() && <RusheeActions {...actions} />}

                        <RusheeRatings {...ratings} />

                        <RusheePisDetails {...pisDetails} />

                        <RusheeCommentsView {...comments} />
                    </div>
                </div>
            </div>
        </div>
    );
}
