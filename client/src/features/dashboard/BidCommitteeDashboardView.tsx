import type { ComponentProps } from "react";

import Error from "../../components/Error";
import Loader from "../../components/Loader";
import Navbar from "../../components/Navbar";
import BidCommitteeFilters from "./BidCommitteeFilters";
import BidCommitteeRusheeCard from "./BidCommitteeRusheeCard";

export type BidCommitteeDashboardRushee = ComponentProps<typeof BidCommitteeRusheeCard>["rushee"] & {
    id: string;
    gtid: string;
    major: string;
    class: string;
};

type Props = {
    status: {
        error: boolean;
        errorTitle: string;
        errorDescription: string;
        loading: boolean;
    };
    filters: ComponentProps<typeof BidCommitteeFilters>;
    cards: {
        rushees: BidCommitteeDashboardRushee[];
        getRusheeId: (gtid: string) => string;
        onOpen: (rushee: BidCommitteeDashboardRushee) => void;
    };
};

export default function BidCommitteeDashboardView({ status, filters, cards }: Props) {
    return (
        <div>
            {status.error ? (
                <Error title={status.errorTitle} description={status.errorDescription} />
            ) : (
                <div>
                    {status.loading ? (
                        <Loader />
                    ) : (
                        <div className="min-h-screen w-full bg-white overflow-y-scroll">
                            <Navbar />

                            <div className="pt-24 p-4 pb-20">
                                <div className="container mx-auto px-4 max-w-7xl">
                                    <BidCommitteeFilters {...filters} />
                                </div>

                                <div className="container mx-auto px-4 max-w-7xl">
                                    <div className="grid gap-6 mt-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                                        {cards.rushees.map((rushee) => {
                                            const rusheeId = cards.getRusheeId(rushee.gtid);
                                            return (
                                                <BidCommitteeRusheeCard
                                                    key={rushee.id}
                                                    rushee={rushee}
                                                    rusheeId={rusheeId}
                                                    onOpen={() => cards.onOpen(rushee)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="h-16" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
