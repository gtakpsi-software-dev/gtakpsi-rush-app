import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { verifyUser } from "../features/auth/verifyUser";
import { format } from 'date-fns';

export default function AddTimeslotPage() {
    const apiBase = import.meta.env.VITE_API_PREFIX + "/admin";
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [timeslotTime, setTimeslotTime] = useState("");
    const [timeslotChange, setTimeslotChange] = useState(1);
    const [result, setResult] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const formatSelectedTime = (dateTimeStr) => {
        if (!dateTimeStr) return null;
        const date = new Date(dateTimeStr);
        return {
            date: format(date, 'MMMM d, yyyy'),
            time: format(date, 'h:mm a')
        };
    };

    useEffect(() => {
        async function checkAuth() {
            try {
                const isValid = await verifyUser();
                if (!isValid) {
                    navigate('/error/Invalid User Credentials/If this is a mistake, try logging back in');
                }
                setLoading(false);
            } catch (error) {
                console.error('Auth error:', error);
                navigate('/error/Invalid User Credentials/If this is a mistake, try logging back in');
            }
        }

        if (loading) {
            checkAuth();
        }
    }, [navigate, loading]);

    const handleAddTimeslot = async () => {
        if (!timeslotTime) {
            setResult("Please select a time");
            return;
        }
        
        setIsSubmitting(true);
        try {
            const payload = {
                time: new Date(timeslotTime).toISOString(),
                change: timeslotChange,
            };
            const response = await axios.post(`${apiBase}/add_pis_timeslot`, payload);
            setResult(JSON.stringify(response.data, null, 2));
            // Clear form on success
            setTimeslotTime("");
            setTimeslotChange(1);
            // Show success animation
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            setResult(error.response?.data || "An error occurred");
        }
        setIsSubmitting(false);
    };

    return loading ? (
        <div className="flex justify-center items-center min-h-screen bg-gradient-to-r from-blue-50 to-orange-50">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
    ) : (
        <div className="min-h-screen bg-gradient-to-r from-blue-50 to-orange-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                {/* Header Section */}
                <div className="bg-white rounded-t-2xl shadow-lg p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-orange-500">
                                Add PIS Timeslot
                            </h1>
                            <p className="mt-2 text-gray-600">
                                Schedule interview slots for potential members
                            </p>
                        </div>
                        <Link 
                            to="/admin"
                            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition duration-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Admin
                        </Link>
                    </div>
                </div>

                {/* Main Form Section */}
                <div className="bg-white rounded-b-2xl shadow-lg p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left Column - DateTime Picker */}
                        <div className="space-y-6">
                            <div>
                                <label className="block text-lg font-semibold text-gray-700 mb-3">
                                    📅 Select Date and Time
                                </label>
                                <input
                                    type="datetime-local"
                                    className="w-full px-4 py-3 text-lg border border-gray-300 rounded-xl 
                                             focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                                             transition duration-200 bg-white shadow-sm
                                             hover:border-blue-400"
                                    value={timeslotTime}
                                    onChange={(e) => setTimeslotTime(e.target.value)}
                                />
                                {timeslotTime && (
                                    <div className="mt-4 bg-blue-50 rounded-xl p-4 border-2 border-blue-100">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-white p-3 rounded-lg shadow-sm text-center min-w-[80px]">
                                                <div className="text-blue-600 text-sm font-semibold">
                                                    {formatSelectedTime(timeslotTime).date}
                                                </div>
                                                <div className="text-orange-500 font-bold mt-1">
                                                    {formatSelectedTime(timeslotTime).time}
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm text-gray-600">
                                                    {timeslotChange} {timeslotChange === 1 ? 'slot' : 'slots'} will be created
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column - Slot Count */}
                        <div className="space-y-6">
                            <div>
                                <label className="block text-lg font-semibold text-gray-700 mb-3">
                                    👥 Number of Interview Slots
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full px-4 py-3 text-lg border border-gray-300 rounded-xl 
                                             focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                                             transition duration-200 bg-white shadow-sm
                                             hover:border-blue-400"
                                    value={timeslotChange}
                                    onChange={(e) => setTimeslotChange(Number(e.target.value))}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="mt-8">
                        <button
                            onClick={handleAddTimeslot}
                            disabled={isSubmitting}
                            className={`w-full bg-gradient-to-r from-blue-600 to-orange-500 
                                      hover:from-blue-700 hover:to-orange-600 
                                      text-white text-lg font-semibold px-6 py-4 rounded-xl 
                                      shadow-lg transform transition duration-200 
                                      hover:scale-[1.02] focus:outline-none focus:ring-2 
                                      focus:ring-offset-2 focus:ring-blue-500
                                      ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Creating Timeslot...
                                </span>
                            ) : (
                                'Create Interview Timeslot'
                            )}
                        </button>
                    </div>

                    {/* Results Section */}
                    {result && (
                        <div className="mt-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-700 mb-3">Status</h2>
                            <div className="bg-white rounded-lg p-4 font-mono text-sm shadow-inner">
                                {result}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showSuccess && (
                <div className="fixed bottom-8 right-8 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg animate-bounce">
                    <div className="flex items-center gap-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Timeslot Created Successfully!
                    </div>
                </div>
            )}
        </div>
    );
}
