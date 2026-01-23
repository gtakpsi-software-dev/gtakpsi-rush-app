import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";

import Navbar from "../components/Navbar";
import Loader from "../components/Loader";
import Error from "../components/Error";
import Badges from "../components/Badge";

import { verifyUser } from "../js/verifications";
import { adminPost } from "../js/adminAxios";

export default function MyPISPage() {
    const user = JSON.parse(localStorage.getItem("user"));
    
    const [rushees, setRushees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [errorTitle, setErrorTitle] = useState("Uh Oh! Something unexpected happened.");
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
                    // Sort by timeslot
                    const sortedRushees = response.data.payload.sort((a, b) => {
                        const timeA = parseInt(a.pis_timeslot?.$date?.$numberLong || "0");
                        const timeB = parseInt(b.pis_timeslot?.$date?.$numberLong || "0");
                        return timeA - timeB;
                    });
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
    
    // Format the timeslot for display
    const formatTimeslot = (timeslot) => {
        if (!timeslot?.$date?.$numberLong) return "No time scheduled";
        const timestamp = parseInt(timeslot.$date.$numberLong);
        return dayjs(timestamp).format("ddd, MMM D, YYYY [at] h:mm A");
    };
    
    // Get relative time until PIS
    const getRelativeTime = (timeslot) => {
        if (!timeslot?.$date?.$numberLong) return null;
        const timestamp = parseInt(timeslot.$date.$numberLong);
        const now = dayjs();
        const pisTime = dayjs(timestamp);
        
        if (pisTime.isBefore(now)) {
            return { text: "Completed", color: "text-green-600" };
        }
        
        const diffDays = pisTime.diff(now, "day");
        const diffHours = pisTime.diff(now, "hour");
        
        if (diffHours < 1) {
            return { text: "Starting soon!", color: "text-red-600" };
        } else if (diffHours < 24) {
            return { text: `In ${diffHours} hour${diffHours > 1 ? "s" : ""}`, color: "text-orange-600" };
        } else {
            return { text: `In ${diffDays} day${diffDays > 1 ? "s" : ""}`, color: "text-apple-gray-600" };
        }
    };
    
    if (error) {
        return <Error title={errorTitle} description={errorDescription} />;
    }
    
    return (
        <div className="min-h-screen w-full bg-white">
            <Navbar />
            
            <div className="pt-24 p-4 pb-20">
                <div className="container mx-auto px-4 max-w-5xl">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-apple-large font-light text-black mb-2">
                            My PIS Appointments
                        </h1>
                        <p className="text-apple-body text-apple-gray-600 font-light">
                            Here are the rushees you're scheduled to interview
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
                                You haven't been assigned to any PIS interviews yet.
                                <br />
                                Check back after the PIS matching algorithm has been run.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Summary Card */}
                            <div className="card-apple p-6 mb-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-apple-footnote text-apple-gray-600 font-light uppercase tracking-wide">
                                            Total Appointments
                                        </p>
                                        <p className="text-4xl font-light text-black">
                                            {rushees.length}
                                        </p>
                                    </div>
                                    <div className="text-6xl">🎤</div>
                                </div>
                            </div>
                            
                            {/* Rushee Cards Grid */}
                            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
                                {rushees.map((rushee, idx) => {
                                    const relativeTime = getRelativeTime(rushee.pis_timeslot);
                                    
                                    return (
                                        <div
                                            key={rushee.gtid || idx}
                                            onClick={() => navigate(`/brother/rushee/${rushee.gtid}`)}
                                            className="card-apple cursor-pointer hover:border-apple-gray-300 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
                                        >
                                            {/* Timeslot Banner */}
                                            <div className="bg-black px-5 py-3 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">🕐</span>
                                                    <span className="text-white text-apple-footnote font-light">
                                                        {formatTimeslot(rushee.pis_timeslot)}
                                                    </span>
                                                </div>
                                                {relativeTime && (
                                                    <span className={`text-apple-caption1 font-medium ${relativeTime.color} bg-white px-2 py-1 rounded-apple`}>
                                                        {relativeTime.text}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div className="flex">
                                                {/* Picture */}
                                                <img
                                                    src={rushee.image_url}
                                                    alt={rushee.name}
                                                    className="w-32 h-32 object-cover"
                                                />
                                                
                                                {/* Content */}
                                                <div className="flex-1 p-4">
                                                    <div className="flex flex-col gap-1 mb-2">
                                                        <h2 className="text-apple-title2 font-normal text-black leading-tight">
                                                            {rushee.name}
                                                        </h2>
                                                        <div className="flex flex-wrap gap-1">
                                                            {rushee.attendance?.map((event, idx) => (
                                                                <Badges text={event.name} key={idx} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="space-y-0.5">
                                                        <p className="text-apple-caption1 text-apple-gray-600 font-light truncate">
                                                            {rushee.major}
                                                        </p>
                                                        <p className="text-apple-caption1 text-apple-gray-600 font-light truncate">
                                                            {rushee.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Ratings Preview */}
                                            {rushee.ratings && rushee.ratings.length > 0 && (
                                                <div className="px-4 pb-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {rushee.ratings.map((rating, rIdx) => (
                                                            <span
                                                                key={rIdx}
                                                                className="bg-apple-gray-100 text-apple-gray-700 px-2 py-1 rounded-apple text-apple-caption1 font-light"
                                                            >
                                                                {rating.name}: {((rating.value / 5) * 100).toFixed(0)}%
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* View Rushee Link */}
                                            <div className="border-t border-apple-gray-200 px-4 py-3 flex items-center justify-between">
                                                <span className="text-apple-footnote text-apple-gray-600 font-light">
                                                    GTID: {rushee.gtid}
                                                </span>
                                                <span className="text-apple-footnote text-black font-normal flex items-center gap-1">
                                                    View Rushee Page →
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
