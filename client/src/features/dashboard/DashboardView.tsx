import type { ComponentProps } from "react";

import Error from "../../components/Error";
import Loader from "../../components/Loader";
import Navbar from "../../components/Navbar";
import PisAvailabilityModal from "../brotherPisAvailability/PisAvailabilityModal";
import DashboardFilters from "./DashboardFilters";
import DashboardRusheeCard from "./DashboardRusheeCard";

export type DashboardCard = ComponentProps<typeof DashboardRusheeCard>["rushee"] & {
    id: string;
    class: string;
};
export type DashboardAvailabilityUser = ComponentProps<typeof PisAvailabilityModal>["user"];

type Props = {
    status: {
        loading: boolean;
        error: boolean;
        errorTitle: string;
        errorDescription: string;
    };
    availability: {
        open: boolean;
        user: DashboardAvailabilityUser | null;
        onSubmit: () => void;
    };
    filters: ComponentProps<typeof DashboardFilters>;
    cards: {
        rushees: DashboardCard[];
        isMidtermMode: boolean;
        showRatings: boolean;
        onOpen: (rushee: DashboardCard) => void;
    };
};

export default function DashboardView({ status, availability, filters, cards }: Props) {
    return (
        <div>
            {availability.open && availability.user && (
                <PisAvailabilityModal user={availability.user} onSubmit={availability.onSubmit} />
            )}

            {status.error ? (
                <Error title={status.errorTitle} description={status.errorDescription} />
            ) : (
                <div>
                    {status.loading ? (
                        <Loader />
                    ) : (
                        <div className="h-screen w-screen bg-white overflow-y-scroll">
                            <Navbar />

                            <div className="pt-24 p-4 pb-20">
                                <div className="container mx-auto px-4 max-w-7xl">
                                    <DashboardFilters {...filters} />

                                    <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {cards.rushees.map((rushee) => (
                                            <DashboardRusheeCard
                                                key={rushee.id}
                                                rushee={rushee}
                                                isMidtermMode={cards.isMidtermMode}
                                                showRatings={cards.showRatings}
                                                onOpen={() => cards.onOpen(rushee)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
