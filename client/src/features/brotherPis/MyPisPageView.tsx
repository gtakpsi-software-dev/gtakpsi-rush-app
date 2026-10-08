import Navbar from "../../components/Navbar";
import Loader from "../../components/Loader";
import Error from "../../components/Error";
import PisAppointmentCard from "./PisAppointmentCard";
import type { PisAppointmentRushee } from "./PisAppointmentCard";
import { formatPisAppointmentTime, getPisAppointmentRelativeTime } from "./appointments";

type Appointment = PisAppointmentRushee & {
    pis_timeslot?: { $date?: { $numberLong?: string } };
};

type Props = {
    rushees: Appointment[];
    loading: boolean;
    error: boolean;
    errorTitle: string;
    errorDescription: string;
    navigate: (path: string) => void;
};

// Display assigned PIS appointments with loading, error, and empty states.
export default function MyPisPageView({
    rushees, loading, error, errorTitle, errorDescription, navigate,
}: Props) {
    if (error) {
        return <Error title={errorTitle} description={errorDescription} />;
    }

    return (
        <div className="min-h-screen w-full bg-white">
            <Navbar />

            <div className="pt-24 p-4 pb-20">
                <div className="container mx-auto px-4 max-w-4xl">
                    <div className="mb-8">
                        <h1 className="text-apple-large font-light text-black mb-2">
                            My PIS Appointments
                        </h1>
                        <p className="text-apple-body text-apple-gray-600 font-light">
                            {rushees.length > 0
                                ? `You have ${rushees.length} interview${rushees.length > 1 ? "s" : ""} scheduled`
                                : "Here are the rushees you're scheduled to interview"
                            }
                        </p>
                    </div>

                    {loading ? (
                        <Loader />
                    ) : rushees.length === 0 ? (
                        <div className="card-apple p-12 text-center">
                            <div className="text-6xl mb-4">📋</div>
                            <h2 className="text-apple-title1 font-light text-black mb-2">
                                No PIS Appointments
                            </h2>
                            <p className="text-apple-body text-apple-gray-600 font-light">
                                You haven&apos;t been assigned to any PIS interviews yet.
                                <br />
                                Check back after the PIS matching algorithm has been run.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {rushees.map((rushee, idx) => {
                                // Render an appointment card with its scheduled and relative times.
                                const relativeTime = getPisAppointmentRelativeTime(rushee.pis_timeslot);

                                return (
                                    <PisAppointmentCard
                                        key={rushee.gtid || idx}
                                        rushee={rushee}
                                        formattedTime={formatPisAppointmentTime(rushee.pis_timeslot)}
                                        relativeTime={relativeTime}
                                        onView={/* Open this appointment’s rushee profile. */ () => navigate(`/brother/rushee/${rushee.gtid}`)}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
