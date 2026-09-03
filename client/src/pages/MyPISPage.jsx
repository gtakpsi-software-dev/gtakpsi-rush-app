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
            return { text: "Completed", color: "text-green-600", bg: "bg-green-50" };
        }
        
        const diffDays = pisTime.diff(now, "day");
        const diffHours = pisTime.diff(now, "hour");
        
        if (diffHours < 1) {
            return { text: "Starting soon!", color: "text-red-600", bg: "bg-red-50" };
        } else if (diffHours < 24) {
            return { text: `In ${diffHours} hour${diffHours > 1 ? "s" : ""}`, color: "text-orange-600", bg: "bg-orange-50" };
        } else {
            return { text: `In ${diffDays} day${diffDays > 1 ? "s" : ""}`, color: "text-apple-gray-600", bg: "bg-apple-gray-50" };
        }
    };
    
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
                                You haven't been assigned to any PIS interviews yet.
                                <br />
                                Check back after the PIS matching algorithm has been run.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {rushees.map((rushee, idx) => {
                                const relativeTime = getRelativeTime(rushee.pis_timeslot);
                                
                                return (
                                    <div
                                        key={rushee.gtid || idx}
                                        className="card-apple overflow-hidden"
                                    >
                                        {/* Main Content */}
                                        <div className="p-6">
                                            <div className="flex flex-col md:flex-row gap-6">
                                                {/* Photo */}
                                                <img
                                                    src={rushee.image_url}
                                                    alt={rushee.name}
                                                    className="w-40 h-40 rounded-apple-2xl object-cover border border-apple-gray-200 shrink-0"
                                                />
                                                
                                                {/* Info */}
                                                <div className="flex-1">
                                                    {/* Name and Badges */}
                                                    <div className="flex flex-col sm:flex-row gap-3 items-start mb-4">
                                                        <h2 className="text-apple-title1 font-light text-black">
                                                            {rushee.name}
                                                        </h2>
                                                        <div className="flex flex-wrap gap-1">
                                                            {rushee.attendance?.map((event, idx) => (
                                                                <Badges text={event.name} key={idx} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Details Grid */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-apple-body">
                                                        {rushee.pronouns && (
                                                            <p className="text-apple-gray-600 font-light">
                                                                <span className="text-black font-normal">Pronouns:</span> {rushee.pronouns}
                                                            </p>
                                                        )}
                                                        <p className="text-apple-gray-600 font-light">
                                                            <span className="text-black font-normal">Email:</span> {rushee.email}
                                                        </p>
                                                        <p className="text-apple-gray-600 font-light">
                                                            <span className="text-black font-normal">Major:</span> {rushee.major}
                                                        </p>
                                                        <p className="text-apple-gray-600 font-light">
                                                            <span className="text-black font-normal">Class:</span> {rushee.class}
                                                        </p>
                                                        <p className="text-apple-gray-600 font-light">
                                                            <span className="text-black font-normal">GTID:</span> {rushee.gtid}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Ratings */}
                                            {rushee.ratings && rushee.ratings.length > 0 && (
                                                <div className="mt-5 pt-5 border-t border-apple-gray-200">
                                                    <p className="text-apple-footnote text-apple-gray-600 font-light mb-3 uppercase tracking-wide">
                                                        Current Ratings
                                                    </p>
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                        {rushee.ratings.map((rating, rIdx) => (
                                                            <div key={rIdx} className="bg-apple-gray-50 rounded-apple p-3">
                                                                <p className="text-apple-caption1 text-apple-gray-600 font-light mb-1">
                                                                    {rating.name}
                                                                </p>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex-1 bg-apple-gray-200 rounded-full h-1.5">
                                                                        <div 
                                                                            className="bg-black h-1.5 rounded-full"
                                                                            style={{ width: `${(rating.value / 5) * 100}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-apple-caption1 text-black font-normal">
                                                                        {rating.value.toFixed(2)}/5
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Footer - Schedule & Action */}
                                        <div className="bg-apple-gray-50 border-t border-apple-gray-200 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-apple border border-apple-gray-200 flex items-center justify-center">
                                                    <span className="text-lg">🕐</span>
                                                </div>
                                                <div>
                                                    <p className="text-apple-body text-black font-normal">
                                                        {formatTimeslot(rushee.pis_timeslot)}
                                                    </p>
                                                    {relativeTime && (
                                                        <p className={`text-apple-footnote font-light ${relativeTime.color}`}>
                                                            {relativeTime.text}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <button
                                                onClick={() => navigate(`/brother/rushee/${rushee.gtid}`)}
                                                className="btn-apple px-5 py-2.5 text-apple-footnote font-light"
                                            >
                                                View Full Profile →
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
