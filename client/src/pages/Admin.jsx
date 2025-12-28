import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { verifyUser } from "../js/verifications";
import Navbar from "../components/Navbar";
import Loader from "../components/Loader";
import { auth, db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";

export default function Admin() {
    const apiBase = import.meta.env.VITE_API_PREFIX + "/admin";
    const rusheeApiBase = import.meta.env.VITE_API_PREFIX + "/rushee";
    const allowlist = (import.meta.env.VITE_ADMIN_ALLOWLIST || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0);

    const [question, setQuestion] = useState("");
    const [questionType, setQuestionType] = useState("");
    const [timeslotTime, setTimeslotTime] = useState("");
    const [timeslotChange, setTimeslotChange] = useState(1);
    const [rushNightName, setRushNightName] = useState("");
    const [rushNightTime, setRushNightTime] = useState("");
    const [loading, setLoading] = useState(true);

    // Admin promotion state
    const [brothers, setBrothers] = useState([]);
    const [brotherSearch, setBrotherSearch] = useState("");
    const [filteredBrothers, setFilteredBrothers] = useState([]);
    const [selectedBrother, setSelectedBrother] = useState(null);
    const [isPromoting, setIsPromoting] = useState(false);

    // Reschedule PIS state
    const [rusheeSearch, setRusheeSearch] = useState("");
    const [rushees, setRushees] = useState([]);
    const [filteredRushees, setFilteredRushees] = useState([]);
    const [selectedRushee, setSelectedRushee] = useState(null);
    const [availableTimeslots, setAvailableTimeslots] = useState([]);
    const [selectedNewTimeslot, setSelectedNewTimeslot] = useState("");

    const navigate = useNavigate();

    const errorTitle = "Invalid User Credentials";
    const errorDescription = "If this is a mistake, try logging back in";

    useEffect(() => {
        async function fetchInitial() {
            await verifyUser()
                .then(async (response) => {
                    if (response == false) {
                        navigate(`/error/${errorTitle}/${errorDescription}`);
                    }
                })
                .catch(() => {
                    navigate(`/error/${errorTitle}/${errorDescription}`);
                });

            const current = auth.currentUser;
            if (!current) {
                navigate(`/error/${errorTitle}/${errorDescription}`);
                return;
            }

            const tokenResult = await current.getIdTokenResult(true);
            const isAdmin = tokenResult.claims?.admin === true;
            const isAllowlisted = current.email && allowlist.includes(current.email.toLowerCase());
            if (!(isAdmin || isAllowlisted)) {
                toast.error("Not authorized");
                navigate(`/error/${errorTitle}/${errorDescription}`);
                return;
            }

            // attach auth header for all admin calls
            axios.defaults.headers.common["Authorization"] = `Bearer ${tokenResult.token}`;

            // Fetch brothers for admin promotion
            try {
                const snapshot = await getDocs(collection(db, "brothers"));
                const list = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setBrothers(list);
            } catch (error) {
                console.error("Failed to fetch brothers:", error);
            }

            // Fetch rushees for reschedule feature
            try {
                const rusheesResponse = await axios.get(`${rusheeApiBase}/get-rushees`);
                if (rusheesResponse.data.status === "success") {
                    setRushees(rusheesResponse.data.payload);
                }
            } catch (error) {
                console.error("Failed to fetch rushees:", error);
            }

            // Fetch available timeslots
            try {
                const timeslotsResponse = await axios.get(`${rusheeApiBase}/get-available-timeslots`);
                if (timeslotsResponse.data.status === "success") {
                    setAvailableTimeslots(timeslotsResponse.data.payload);
                }
            } catch (error) {
                console.error("Failed to fetch timeslots:", error);
            }

            setLoading(false);
        }

        if (loading === true) {
            fetchInitial();
        }
    }, [loading, navigate, rusheeApiBase]);

    // Filter rushees based on search
    useEffect(() => {
        if (rusheeSearch.trim() === "") {
            setFilteredRushees([]);
            return;
        }
        const search = rusheeSearch.toLowerCase();
        const filtered = rushees.filter(r => 
            r.name.toLowerCase().includes(search) ||
            r.gtid.includes(search)
        );
        setFilteredRushees(filtered.slice(0, 10)); // Limit to 10 results
    }, [rusheeSearch, rushees]);

    // Filter brothers for admin promotion
    useEffect(() => {
        if (brotherSearch.trim() === "") {
            setFilteredBrothers([]);
            return;
        }
        const search = brotherSearch.toLowerCase();
        const filtered = brothers.filter((b) => {
            const fullName = `${b.firstname || b.firstName || ""} ${b.lastname || b.lastName || ""}`.trim();
            return (
                (b.email || "").toLowerCase().includes(search) ||
                fullName.toLowerCase().includes(search)
            );
        });
        setFilteredBrothers(filtered.slice(0, 10));
    }, [brotherSearch, brothers]);

    const handleRequest = async (endpoint, payload, method = "post", successMessage = "Success!") => {
        try {
            const updatedPayload = { ...payload };

            if (updatedPayload.time) {
                updatedPayload.time = new Date(updatedPayload.time).toISOString();
            }

            const response = await axios[method](`${apiBase}/${endpoint}`, updatedPayload);
            
            if (response.data.status === "success") {
                toast.success(successMessage, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            } else {
                toast.error(response.data.message || "Something went wrong", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "An error occurred", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        }
    };

    const exportRusheeNumbers = async () => {
        try {
            const response = await axios.get(`${apiBase}/export-rushee-numbers`);

            if (response.data.status === "success") {
                const mappings = response.data.payload;

                const csvHeaders = ["Rushee Number", "Name", "GTID"];
                const csvRows = [
                    csvHeaders.join(","),
                    ...mappings.map(m => `"${m.rushee_number}","${m.name}","${m.gtid}"`)
                ];

                const csvContent = csvRows.join("\n");
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");

                if (link.download !== undefined) {
                    const url = URL.createObjectURL(blob);
                    link.setAttribute("href", url);
                    link.setAttribute("download", `Rushee_Numbers_${new Date().toISOString().split('T')[0]}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }

                toast.success(`Exported ${mappings.length} rushee numbers`, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            } else {
                toast.error("Failed to fetch rushee numbers", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error(`Export error: ${error.message}`, {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        }
    };

    const handleSelectRushee = (rushee) => {
        setSelectedRushee(rushee);
        setRusheeSearch(rushee.name);
        setFilteredRushees([]);
    };

    const handleSelectBrother = (brother) => {
        setSelectedBrother(brother);
        const fullName = `${brother.firstname || brother.firstName || ""} ${brother.lastname || brother.lastName || ""}`.trim();
        setBrotherSearch(fullName || brother.email || "");
        setFilteredBrothers([]);
    };

    const handleMakeAdmin = async () => {
        if (!selectedBrother) {
            toast.error("Select a brother first");
            return;
        }
        const uid = selectedBrother.uid || selectedBrother.id || selectedBrother._id;
        if (!uid) {
            toast.error("No UID found for this brother");
            return;
        }
        setIsPromoting(true);
        try {
            const response = await axios.post(`${apiBase}/make-admin`, { uid });
            if (response.data.status === "success") {
                toast.success(`Granted admin to ${selectedBrother.email || "brother"}`, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            } else {
                toast.error(response.data.message || "Failed to grant admin", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to grant admin", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setIsPromoting(false);
        }
    };

    const handleReschedulePIS = async () => {
        if (!selectedRushee || !selectedNewTimeslot) {
            toast.error("Please select a rushee and a new timeslot", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
            return;
        }

        try {
            const response = await axios.post(
                `${rusheeApiBase}/reschedule-pis/${selectedRushee.gtid}`,
                JSON.stringify(selectedNewTimeslot),
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.status === "success") {
                toast.success(`PIS rescheduled for ${selectedRushee.name}`, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
                // Reset the form
                setSelectedRushee(null);
                setRusheeSearch("");
                setSelectedNewTimeslot("");
                
                // Refresh available timeslots
                try {
                    const timeslotsResponse = await axios.get(`${rusheeApiBase}/get-available-timeslots`);
                    if (timeslotsResponse.data.status === "success") {
                        setAvailableTimeslots(timeslotsResponse.data.payload);
                    }
                } catch (e) {
                    console.error("Failed to refresh timeslots:", e);
                }
            } else {
                toast.error(response.data.message || "Failed to reschedule", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "An error occurred", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        }
    };

    const formatTimeslot = (timeslot) => {
        const dateNum = parseInt(timeslot.time.$date.$numberLong);
        const date = new Date(dateNum);
        return date.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const formatCurrentPISTime = (rushee) => {
        if (!rushee.pis_timeslot) return "Not scheduled";
        try {
            const dateNum = parseInt(rushee.pis_timeslot.$date.$numberLong);
            const date = new Date(dateNum);
            return date.toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        } catch (e) {
            return "Not scheduled";
        }
    };

    const exportPISSchedule = async () => {
        try {
            const api = import.meta.env.VITE_API_PREFIX;
            const response = await axios.get(`${api}/rushee/get-timeslots`);

            if (response.data.status === "success") {
                const timeslots = response.data.payload;

                const csvHeaders = ["Date", "Time", "Rushee Name", "Flexible"];

                const processedSlots = timeslots.map(slot => {
                    const jsDate = new Date(parseInt(slot.time.$date.$numberLong));
                    const date = jsDate.toLocaleDateString();
                    const time = jsDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const rusheeName = `${slot.rushee_first_name} ${slot.rushee_last_name}`;
                    const flexWindow = slot.flex_window ? "Yes" : "No";

                    const csvRow = [
                        `"${date}"`,
                        `"${time}"`,
                        `"${rusheeName}"`,
                        `"${flexWindow}"`
                    ].join(",");

                    return { originalDate: jsDate, csvRow };
                });

                processedSlots.sort((a, b) => a.originalDate - b.originalDate);

                const csvRows = [csvHeaders.join(","), ...processedSlots.map(slot => slot.csvRow)];
                const csvContent = csvRows.join("\n");
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");

                if (link.download !== undefined) {
                    const url = URL.createObjectURL(blob);
                    link.setAttribute("href", url);
                    link.setAttribute("download", `PIS_Schedule_${new Date().toISOString().split('T')[0]}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }

                toast.success(`Exported ${timeslots.length} PIS appointments`, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            } else {
                toast.error("Failed to fetch PIS timeslots", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error(`Export error: ${error.message}`, {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        }
    };

    if (loading) {
        return <Loader />;
    }

    return (
        <div className="min-h-screen w-full bg-white">
            <Navbar />

            <div className="pt-24 p-4 pb-20">
                <div className="container mx-auto px-4 max-w-4xl">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-apple-large font-light text-black">Admin Panel</h1>
                        <p className="text-apple-body text-apple-gray-600 font-light mt-2">
                            Manage PIS questions, timeslots, and rush nights
                        </p>
                    </div>

                    {/* Exports & Fetch Section */}
                    <div className="mb-10">
                        <h2 className="text-apple-title2 font-normal text-black mb-4">Exports & Data</h2>
                        
                        <div className="grid gap-4 md:grid-cols-2">
                            {/* Export Rushee Numbers */}
                            <div className="card-apple p-5">
                                <h3 className="text-apple-headline font-normal text-black mb-2">Rushee Numbers</h3>
                                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                                    Export CSV with rushee numbers (001, 002...) mapped to names
                                </p>
                                <button
                                    onClick={exportRusheeNumbers}
                                    className="w-full bg-black text-white py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-800 transition-all duration-200"
                                >
                                    Export Rushee Numbers
                                </button>
                            </div>

                            {/* Export PIS Schedule */}
                            <div className="card-apple p-5">
                                <h3 className="text-apple-headline font-normal text-black mb-2">PIS Schedule</h3>
                                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                                    Export CSV with all PIS appointments
                                </p>
                                <button
                                    onClick={exportPISSchedule}
                                    className="w-full bg-black text-white py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-800 transition-all duration-200"
                                >
                                    Export PIS Schedule
                                </button>
                            </div>

                            {/* Fetch PIS Questions */}
                            <div className="card-apple p-5">
                                <h3 className="text-apple-headline font-normal text-black mb-2">PIS Questions</h3>
                                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                                    View all current PIS questions in console
                                </p>
                                <button
                                    onClick={() => handleRequest("get_pis_questions", {}, "get", "Check console for questions")}
                                    className="w-full bg-apple-gray-100 text-black py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-200 transition-all duration-200 border border-apple-gray-200"
                                >
                                    Fetch Questions
                                </button>
                            </div>

                            {/* Fetch PIS Timeslots */}
                            <div className="card-apple p-5">
                                <h3 className="text-apple-headline font-normal text-black mb-2">PIS Timeslots</h3>
                                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                                    View all current PIS timeslots in console
                                </p>
                                <button
                                    onClick={() => handleRequest("get_pis_timeslots", {}, "get", "Check console for timeslots")}
                                    className="w-full bg-apple-gray-100 text-black py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-200 transition-all duration-200 border border-apple-gray-200"
                                >
                                    Fetch Timeslots
                                </button>
                            </div>

                            {/* Admin Access */}
                            <div className="card-apple p-5">
                                <h3 className="text-apple-headline font-normal text-black mb-2">Admin Access</h3>
                                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                                    Search a brother and grant admin access
                                </p>
                                <div className="relative mb-3">
                                    <input
                                        type="text"
                                        placeholder="Search brother by name or email..."
                                        className="input-apple text-apple-body"
                                        value={brotherSearch}
                                        onChange={(e) => {
                                            setBrotherSearch(e.target.value);
                                            if (selectedBrother && e.target.value !== (selectedBrother.email || "")) {
                                                setSelectedBrother(null);
                                            }
                                        }}
                                    />
                                    {filteredBrothers.length > 0 && !selectedBrother && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-apple-gray-200 rounded-apple-lg shadow-lg max-h-60 overflow-y-auto">
                                            {filteredBrothers.map((brother) => {
                                                const fullName = `${brother.firstname || brother.firstName || ""} ${brother.lastname || brother.lastName || ""}`.trim();
                                                return (
                                                    <div
                                                        key={brother.uid || brother.id || brother._id}
                                                        className="px-4 py-3 hover:bg-apple-gray-100 cursor-pointer border-b border-apple-gray-100 last:border-b-0"
                                                        onClick={() => handleSelectBrother(brother)}
                                                    >
                                                        <div className="text-apple-body font-normal text-black">
                                                            {fullName || brother.email}
                                                        </div>
                                                        <div className="text-apple-caption2 text-apple-gray-600">
                                                            {brother.email}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {selectedBrother && (
                                    <div className="bg-apple-gray-50 rounded-apple-lg p-4 border border-apple-gray-200 mb-3">
                                        <div className="text-apple-body font-medium text-black">
                                            {`${selectedBrother.firstname || selectedBrother.firstName || ""} ${selectedBrother.lastname || selectedBrother.lastName || ""}`.trim() || selectedBrother.email}
                                        </div>
                                        <div className="text-apple-caption2 text-apple-gray-600 mt-1">
                                            {selectedBrother.email}
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={handleMakeAdmin}
                                    disabled={isPromoting}
                                    className="w-full bg-black text-white py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-800 transition-all duration-200 disabled:opacity-60"
                                >
                                    {isPromoting ? "Granting..." : "Make Admin"}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-apple-gray-200 my-10"></div>

                    {/* Add/Delete Section */}
                    <div>
                        <h2 className="text-apple-title2 font-normal text-black mb-4">Manage Data</h2>

                        <div className="space-y-6">
                            {/* PIS Questions */}
                            <div className="card-apple p-6">
                                <h3 className="text-apple-headline font-normal text-black mb-4">PIS Questions</h3>
                                <div className="space-y-3 mb-4">
                                    <input
                                        type="text"
                                        placeholder="Question text"
                                        className="input-apple text-apple-body"
                                        value={question}
                                        onChange={(e) => setQuestion(e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Question type (e.g., FR, MC)"
                                        className="input-apple text-apple-body"
                                        value={questionType}
                                        onChange={(e) => setQuestionType(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleRequest("add_pis_question", { question, question_type: questionType }, "post", "Question added!")}
                                        className="flex-1 bg-black text-white py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-800 transition-all duration-200"
                                    >
                                        Add Question
                                    </button>
                                    <button
                                        onClick={() => handleRequest("delete_pis_question", { question, question_type: questionType }, "post", "Question deleted!")}
                                        className="flex-1 bg-white text-red-600 py-3 px-4 rounded-apple-xl text-apple-body font-light border border-red-200 hover:bg-red-50 transition-all duration-200"
                                    >
                                        Delete Question
                                    </button>
                                </div>
                            </div>

                            {/* PIS Timeslots */}
                            <div className="card-apple p-6">
                                <h3 className="text-apple-headline font-normal text-black mb-4">PIS Timeslots</h3>
                                <div className="space-y-3 mb-4">
                                    <input
                                        type="datetime-local"
                                        className="input-apple text-apple-body"
                                        value={timeslotTime}
                                        onChange={(e) => setTimeslotTime(e.target.value)}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Number of slots"
                                        className="input-apple text-apple-body"
                                        value={timeslotChange}
                                        onChange={(e) => setTimeslotChange(Number(e.target.value))}
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleRequest("add_pis_timeslot", { time: timeslotTime, change: timeslotChange }, "post", "Timeslot added!")}
                                        className="flex-1 bg-black text-white py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-800 transition-all duration-200"
                                    >
                                        Add Timeslot
                                    </button>
                                    <button
                                        onClick={() => handleRequest("delete_pis_timeslot", { time: timeslotTime, change: timeslotChange }, "post", "Timeslot deleted!")}
                                        className="flex-1 bg-white text-red-600 py-3 px-4 rounded-apple-xl text-apple-body font-light border border-red-200 hover:bg-red-50 transition-all duration-200"
                                    >
                                        Delete Timeslot
                                    </button>
                                </div>
                            </div>

                            {/* Rush Nights */}
                            <div className="card-apple p-6">
                                <h3 className="text-apple-headline font-normal text-black mb-4">Rush Nights</h3>
                                <div className="space-y-3 mb-4">
                                    <input
                                        type="text"
                                        placeholder="Rush night name"
                                        className="input-apple text-apple-body"
                                        value={rushNightName}
                                        onChange={(e) => setRushNightName(e.target.value)}
                                    />
                                    <input
                                        type="datetime-local"
                                        className="input-apple text-apple-body"
                                        value={rushNightTime}
                                        onChange={(e) => setRushNightTime(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleRequest("add-rush-night", { name: rushNightName, time: rushNightTime }, "post", "Rush night added!")}
                                        className="flex-1 bg-black text-white py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-800 transition-all duration-200"
                                    >
                                        Add Rush Night
                                    </button>
                                    <button
                                        onClick={() => handleRequest("delete_rush_night", { time: rushNightTime }, "post", "Rush night deleted!")}
                                        className="flex-1 bg-white text-red-600 py-3 px-4 rounded-apple-xl text-apple-body font-light border border-red-200 hover:bg-red-50 transition-all duration-200"
                                    >
                                        Delete Rush Night
                                    </button>
                                </div>
                            </div>

                            {/* Reschedule PIS */}
                            <div className="card-apple p-6">
                                <h3 className="text-apple-headline font-normal text-black mb-4">Reschedule PIS</h3>
                                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                                    Search for a rushee and reassign their PIS timeslot
                                </p>
                                
                                <div className="space-y-4">
                                    {/* Rushee Search */}
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Search rushee by name or GTID..."
                                            className="input-apple text-apple-body"
                                            value={rusheeSearch}
                                            onChange={(e) => {
                                                setRusheeSearch(e.target.value);
                                                if (selectedRushee && e.target.value !== selectedRushee.name) {
                                                    setSelectedRushee(null);
                                                }
                                            }}
                                        />
                                        
                                        {/* Search Results Dropdown */}
                                        {filteredRushees.length > 0 && !selectedRushee && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-apple-gray-200 rounded-apple-lg shadow-lg max-h-60 overflow-y-auto">
                                                {filteredRushees.map((rushee) => (
                                                    <div
                                                        key={rushee.gtid}
                                                        className="px-4 py-3 hover:bg-apple-gray-100 cursor-pointer border-b border-apple-gray-100 last:border-b-0"
                                                        onClick={() => handleSelectRushee(rushee)}
                                                    >
                                                        <div className="text-apple-body font-normal text-black">
                                                            {rushee.name}
                                                        </div>
                                                        <div className="text-apple-caption2 text-apple-gray-600">
                                                            GTID: {rushee.gtid}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Selected Rushee Info */}
                                    {selectedRushee && (
                                        <div className="bg-apple-gray-50 rounded-apple-lg p-4 border border-apple-gray-200">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="text-apple-body font-medium text-black">
                                                        {selectedRushee.name}
                                                    </div>
                                                    <div className="text-apple-caption2 text-apple-gray-600 mt-1">
                                                        GTID: {selectedRushee.gtid}
                                                    </div>
                                                    <div className="text-apple-caption2 text-apple-gray-600 mt-1">
                                                        Current PIS: <span className="font-medium">{formatCurrentPISTime(selectedRushee)}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setSelectedRushee(null);
                                                        setRusheeSearch("");
                                                    }}
                                                    className="text-apple-gray-400 hover:text-apple-gray-600 text-xl"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* New Timeslot Selection */}
                                    <div>
                                        <label className="text-apple-footnote text-apple-gray-600 font-light mb-2 block">
                                            Select New Timeslot
                                        </label>
                                        <select
                                            className="input-apple text-apple-body"
                                            value={selectedNewTimeslot}
                                            onChange={(e) => setSelectedNewTimeslot(e.target.value)}
                                            disabled={!selectedRushee}
                                        >
                                            <option value="">Choose a timeslot...</option>
                                            {availableTimeslots.map((slot, index) => (
                                                <option 
                                                    key={index} 
                                                    value={new Date(parseInt(slot.time.$date.$numberLong)).toISOString()}
                                                >
                                                    {formatTimeslot(slot)} ({slot.capacity} spot{slot.capacity !== 1 ? 's' : ''} available)
                                                </option>
                                            ))}
                                        </select>
                                        {availableTimeslots.length === 0 && (
                                            <p className="text-apple-caption2 text-apple-gray-500 mt-2">
                                                No available timeslots found
                                            </p>
                                        )}
                                    </div>

                                    {/* Reschedule Button */}
                                    <button
                                        onClick={handleReschedulePIS}
                                        disabled={!selectedRushee || !selectedNewTimeslot}
                                        className={`w-full py-3 px-4 rounded-apple-xl text-apple-body font-light transition-all duration-200 ${
                                            selectedRushee && selectedNewTimeslot
                                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                : 'bg-apple-gray-200 text-apple-gray-400 cursor-not-allowed'
                                        }`}
                                    >
                                        Reschedule PIS
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
