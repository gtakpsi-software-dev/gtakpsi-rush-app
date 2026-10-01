import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "../components/Navbar";
import Loader from "../components/Loader";
import Error from "../components/Error";
import PisAppointmentCard from "../features/brotherPis/PisAppointmentCard";

import { verifyUser } from "../features/auth/verifyUser";
import {
    sortPisAppointments,
    formatPisAppointmentTime,
    getPisAppointmentRelativeTime,
} from "../features/brotherPis/appointments";
import { adminPost } from "../js/adminAxios";

export default function MyPISPage() {
    const user = JSON.parse(localStorage.getItem("user"));
    
    const [rushees, setRushees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [errorTitle] = useState("Uh Oh! Something unexpected happened.");
    const [errorDescription, setErrorDescription] = useState("");
    
    const navigate = useNavigate();
    const api = import.meta.env.VITE_API_PREFIX;
    
    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            
            try {
                const isAuthenticated = await verifyUser();
                if (!isAuthenticated) {
                    navigate("/");
                    return;
                }
                
                const payload = {
                    first_name: user.firstname,
                    last_name: user.lastname,
                };
                
                const response = await adminPost(`${api}/admin/get-brother-pis`, payload);
                
                if (response.data.status === "success") {
                    const sortedRushees = sortPisAppointments(response.data.payload);
                    setRushees(sortedRushees);
                } else {
                    setErrorDescription("There was an issue fetching your PIS appointments.");
                    setError(true);
                }
            } catch (err) {
                console.error("Error fetching PIS appointments:", err);
                setErrorDescription("There was a network error while fetching your PIS appointments.");
                setError(true);
            }
            
            setLoading(false);
        }
        
        fetchData();
    }, []);
    
    if (error) {
        return <Error title={errorTitle} description={errorDescription} />;
    }
    
    return (
        <div className="min-h-screen w-full bg-white">
            <Navbar />
            
            <div className="pt-24 p-4 pb-20">
                <div className="container mx-auto px-4 max-w-4xl">
                    {/* Header */}
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
                                const relativeTime = getPisAppointmentRelativeTime(rushee.pis_timeslot);

                                return (
                                    <PisAppointmentCard
                                        key={rushee.gtid || idx}
                                        rushee={rushee}
                                        formattedTime={formatPisAppointmentTime(rushee.pis_timeslot)}
                                        relativeTime={relativeTime}
                                        onView={() => navigate(`/brother/rushee/${rushee.gtid}`)}
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
