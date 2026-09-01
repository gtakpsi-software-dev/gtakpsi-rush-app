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
    const [questionOrder, setQuestionOrder] = useState("");
    const [questionCategory, setQuestionCategory] = useState("");
    const [pisQuestions, setPisQuestions] = useState([]);
    const [pisQuestionsLoading, setPisQuestionsLoading] = useState(false);
    const [categoryEdits, setCategoryEdits] = useState({}); // question -> in-progress category text
    const [timeslotTime, setTimeslotTime] = useState("");
    const [timeslotChange, setTimeslotChange] = useState(1);
    const [rushNightName, setRushNightName] = useState("");
    const [rushNightTime, setRushNightTime] = useState("");
    const [loading, setLoading] = useState(true);

    // Admin/Bidcom promotion state
    const [brothers, setBrothers] = useState([]);
    const [brotherSearch, setBrotherSearch] = useState("");
    const [filteredBrothers, setFilteredBrothers] = useState([]);
    const [selectedBrother, setSelectedBrother] = useState(null);
    const [isPromoting, setIsPromoting] = useState(false);
    const [brotherAdminStatus, setBrotherAdminStatus] = useState(null); // true/false/null
    const [brotherBidcomStatus, setBrotherBidcomStatus] = useState(null); // true/false/null

    // Reschedule PIS state
    const [rusheeSearch, setRusheeSearch] = useState("");
    const [rushees, setRushees] = useState([]);
    const [filteredRushees, setFilteredRushees] = useState([]);
    const [selectedRushee, setSelectedRushee] = useState(null);
    const [availableTimeslots, setAvailableTimeslots] = useState([]);
    const [selectedNewTimeslot, setSelectedNewTimeslot] = useState("");

    // PIS Availability Form state
    const [pisFormStatus, setPisFormStatus] = useState({ is_active: false, sent_at: null });
    const [pisFormLoading, setPisFormLoading] = useState(false);
    const [brotherAvailabilities, setBrotherAvailabilities] = useState([]);
    
    // Edit brother availability state
    const [editingBrotherAvailability, setEditingBrotherAvailability] = useState(null);
    const [editingSlots, setEditingSlots] = useState(new Set());
    const [allPisTimeslots, setAllPisTimeslots] = useState([]);
    const [savingAvailability, setSavingAvailability] = useState(false);

    // Rush App disable state
    const [rushAppStatus, setRushAppStatus] = useState({ disable_bidcom: false, disable_regular: false, midterm_mode: false });
    const [rushAppLoading, setRushAppLoading] = useState(false);

    // Midterm mode state
    const [midtermLoading, setMidtermLoading] = useState(false);

    // Comment visibility settings state
    const [commentVisibilityStatus, setCommentVisibilityStatus] = useState({ require_comment_to_view: true });
    const [commentVisibilityLoading, setCommentVisibilityLoading] = useState(false);

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

            // Fetch PIS availability form status
            try {
                const formStatusResponse = await axios.get(`${apiBase}/pis-availability/status`);
                if (formStatusResponse.data.status === "success") {
                    setPisFormStatus({
                        is_active: formStatusResponse.data.is_active,
                        sent_at: formStatusResponse.data.sent_at
                    });
                }
            } catch (error) {
                console.error("Failed to fetch PIS form status:", error);
            }

            // Fetch brother availabilities
            try {
                const availabilitiesResponse = await axios.get(`${apiBase}/pis-availability/all`);
                if (availabilitiesResponse.data.status === "success") {
                    setBrotherAvailabilities(availabilitiesResponse.data.payload);
                }
            } catch (error) {
                console.error("Failed to fetch brother availabilities:", error);
            }

            // Fetch all PIS timeslots for editing availability
            try {
                const timeslotsResponse = await axios.get(`${apiBase}/get_pis_timeslots`);
                if (timeslotsResponse.data.status === "success") {
                    const sorted = timeslotsResponse.data.payload.sort((a, b) => {
                        const timeA = parseInt(a.time.$date.$numberLong);
                        const timeB = parseInt(b.time.$date.$numberLong);
                        return timeA - timeB;
                    });
                    setAllPisTimeslots(sorted);
                }
            } catch (error) {
                console.error("Failed to fetch PIS timeslots:", error);
            }

            // Fetch Rush App status
            try {
                const rushAppResponse = await axios.get(`${apiBase}/rush-app/status`);
                if (rushAppResponse.data.status === "success") {
                    setRushAppStatus({
                        disable_bidcom: rushAppResponse.data.disable_bidcom,
                        disable_regular: rushAppResponse.data.disable_regular,
                        midterm_mode: rushAppResponse.data.midterm_mode ?? false,
                        updated_by: rushAppResponse.data.updated_by
                    });
                }
            } catch (error) {
                console.error("Failed to fetch Rush App status:", error);
            }

            // Fetch Comment Visibility status
            try {
                const commentVisibilityResponse = await axios.get(`${apiBase}/comment-visibility/status`);
                if (commentVisibilityResponse.data.status === "success") {
                    setCommentVisibilityStatus({
                        require_comment_to_view: commentVisibilityResponse.data.require_comment_to_view,
                        updated_by: commentVisibilityResponse.data.updated_by
                    });
                }
            } catch (error) {
                console.error("Failed to fetch comment visibility status:", error);
            }

            setLoading(false);
        }

        if (loading === true) {
            fetchInitial();
        }
    }, [loading, navigate, rusheeApiBase]);

    const fetchPisQuestions = async () => {
        setPisQuestionsLoading(true);
        try {
            const response = await axios.get(`${apiBase}/get_pis_questions`);
            if (response.data.status === "success") {
                const sorted = [...response.data.payload].sort((a, b) => {
                    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
                    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
                    return orderA - orderB;
                });
                setPisQuestions(sorted);
            }
        } catch (error) {
            toast.error("Failed to load PIS questions", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        }
        setPisQuestionsLoading(false);
    };

    useEffect(() => {
        fetchPisQuestions();
    }, []);

    const saveQuestionCategory = async (q) => {
        const rawCategory = (categoryEdits[q.question] ?? q.category ?? "").trim();
        const category = rawCategory === "" ? null : rawCategory;
        try {
            const response = await axios.post(`${apiBase}/update_pis_question_category`, {
                question: q.question,
                question_type: q.question_type,
                category,
            });
            if (response.data.status === "success") {
                toast.success("Category updated!", {
                    position: "top-center",
                    autoClose: 2000,
                    theme: "dark",
                });
                fetchPisQuestions();
            } else {
                toast.error(response.data.message || "Failed to update category", {
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

    const exportRusheePersonalInfo = async () => {
        try {
            const response = await axios.get(`${apiBase}/export-rushee-info`);

            if (response.data.status === "success") {
                const rushees = response.data.payload;

                const csvHeaders = ["First Name", "Last Name", "GTID", "Email", "Phone Number", "Housing", "Major", "Class", "Pronouns", "Exposure"];
                const csvRows = [
                    csvHeaders.join(","),
                    ...rushees.map(r => 
                        [
                            `"${(r.first_name || '').replace(/"/g, '""')}"`,
                            `"${(r.last_name || '').replace(/"/g, '""')}"`,
                            `"${r.gtid || ''}"`,
                            `"${r.email || ''}"`,
                            `"${r.phone_number || ''}"`,
                            `"${(r.housing || '').replace(/"/g, '""')}"`,
                            `"${(r.major || '').replace(/"/g, '""')}"`,
                            `"${r.class || ''}"`,
                            `"${(r.pronouns || '').replace(/"/g, '""')}"`,
                            `"${(r.exposure || '').replace(/"/g, '""')}"`
                        ].join(",")
                    )
                ];

                const csvContent = csvRows.join("\n");
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");

                if (link.download !== undefined) {
                    const url = URL.createObjectURL(blob);
                    link.setAttribute("href", url);
                    link.setAttribute("download", `Rushee_Personal_Info_${new Date().toISOString().split('T')[0]}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }

                toast.success(`Exported personal info for ${rushees.length} rushees`, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            } else {
                toast.error("Failed to fetch rushee personal info", {
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
        fetchBrotherAdminStatus(brother);
    };

    const fetchBrotherAdminStatus = async (brother) => {
        const uid = brother?.uid || brother?.id || brother?._id;
        if (!uid) {
            setBrotherAdminStatus(null);
            setBrotherBidcomStatus(null);
            return;
        }
        try {
            const response = await axios.post(`${apiBase}/get-admin-status`, { uid });
            if (response.data.status === "success") {
                setBrotherAdminStatus(response.data.admin === true);
                setBrotherBidcomStatus(response.data.bidcom === true);
            } else {
                setBrotherAdminStatus(null);
                setBrotherBidcomStatus(null);
            }
        } catch (_e) {
            setBrotherAdminStatus(null);
            setBrotherBidcomStatus(null);
        }
    };

    const handleSetAdmin = async (makeAdmin) => {
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
            const response = await axios.post(`${apiBase}/make-admin`, { uid, make_admin: makeAdmin });
            if (response.data.status === "success") {
                setBrotherAdminStatus(makeAdmin);
                toast.success(
                    makeAdmin
                        ? `Granted admin to ${selectedBrother.email || "brother"}`
                        : `Removed admin from ${selectedBrother.email || "brother"}`,
                    {
                        position: "top-center",
                        autoClose: 3000,
                        theme: "dark",
                    }
                );
            } else {
                toast.error(response.data.message || "Failed to update admin", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to update admin", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setIsPromoting(false);
        }
    };

    const handleSetBidcom = async (makeBidcom) => {
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
            const response = await axios.post(`${apiBase}/make-bidcom`, { uid, make_bidcom: makeBidcom });
            if (response.data.status === "success") {
                setBrotherBidcomStatus(makeBidcom);
                toast.success(
                    makeBidcom
                        ? `Granted bid committee access to ${selectedBrother.email || "brother"}`
                        : `Removed bid committee access from ${selectedBrother.email || "brother"}`,
                    {
                        position: "top-center",
                        autoClose: 3000,
                        theme: "dark",
                    }
                );
            } else {
                toast.error(response.data.message || "Failed to update bid committee", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to update bid committee", {
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
                    const time = jsDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
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

    // ========== PIS Availability Handlers ==========
    
    const handleSendPISForm = async () => {
        setPisFormLoading(true);
        try {
            const response = await axios.post(`${apiBase}/pis-availability/send-form`);
            if (response.data.status === "success") {
                setPisFormStatus({ is_active: true, sent_at: new Date().toISOString() });
                toast.success("PIS availability form sent to all brothers!", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            } else {
                toast.error(response.data.message || "Failed to send form", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error("Failed to send form", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setPisFormLoading(false);
        }
    };

    const handleClearAndResendPISForm = async () => {
        if (!window.confirm("This will clear all existing brother availability submissions and resend the form. Continue?")) {
            return;
        }
        setPisFormLoading(true);
        try {
            const response = await axios.post(`${apiBase}/pis-availability/clear-and-resend`);
            if (response.data.status === "success") {
                setPisFormStatus({ is_active: true, sent_at: new Date().toISOString() });
                setBrotherAvailabilities([]);
                toast.success("Cleared submissions and resent form!", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            } else {
                toast.error(response.data.message || "Failed to clear and resend", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error("Failed to clear and resend", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setPisFormLoading(false);
        }
    };

    const handleDeactivatePISForm = async () => {
        setPisFormLoading(true);
        try {
            const response = await axios.post(`${apiBase}/pis-availability/deactivate`);
            if (response.data.status === "success") {
                setPisFormStatus({ ...pisFormStatus, is_active: false });
                toast.success("Form deactivated", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error("Failed to deactivate form", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setPisFormLoading(false);
        }
    };

    const handleAutoAssignBrothers = async () => {
        if (!window.confirm("This will automatically assign available brothers to all PIS slots. Continue?")) {
            return;
        }
        setPisFormLoading(true);
        try {
            const response = await axios.post(`${apiBase}/pis-availability/auto-assign`);
            if (response.data.status === "success") {
                toast.success(response.data.message, {
                    position: "top-center",
                    autoClose: 5000,
                    theme: "dark",
                });
            } else {
                toast.error(response.data.message || "Failed to auto-assign", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error("Failed to auto-assign brothers", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setPisFormLoading(false);
        }
    };

    const handleClearAssignments = async () => {
        if (!window.confirm("This will clear all brother assignments from PIS slots. Continue?")) {
            return;
        }
        setPisFormLoading(true);
        try {
            const response = await axios.post(`${apiBase}/pis-availability/clear-assignments`);
            if (response.data.status === "success") {
                toast.success(response.data.message, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            } else {
                toast.error(response.data.message || "Failed to clear assignments", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error("Failed to clear assignments", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setPisFormLoading(false);
        }
    };

    const exportPISWithBrothers = async () => {
        try {
            const response = await axios.get(`${apiBase}/pis-availability/export-csv`);
            
            if (response.data.status === "success") {
                const data = response.data.payload;
                
                const csvHeaders = ["Rushee", "Date", "Time", "Brother 1", "Brother 2"];
                
                const processedData = data.map(item => {
                    let jsDate;
                    if (item.timeslot && item.timeslot.$date && item.timeslot.$date.$numberLong) {
                        jsDate = new Date(parseInt(item.timeslot.$date.$numberLong));
                    } else {
                        jsDate = new Date(item.timeslot);
                    }
                    const date = jsDate.toLocaleDateString();
                    const time = jsDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
                    
                    const brother1 = item.brother_1 === "none none" ? "" : item.brother_1;
                    const brother2 = item.brother_2 === "none none" ? "" : item.brother_2;
                    
                    const csvRow = [
                        `"${item.rushee_name}"`,
                        `"${date}"`,
                        `"${time}"`,
                        `"${brother1}"`,
                        `"${brother2}"`
                    ].join(",");
                    
                    return { originalDate: jsDate, csvRow };
                });
                
                processedData.sort((a, b) => a.originalDate - b.originalDate);
                
                const csvRows = [csvHeaders.join(","), ...processedData.map(d => d.csvRow)];
                const csvContent = csvRows.join("\n");
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                
                if (link.download !== undefined) {
                    const url = URL.createObjectURL(blob);
                    link.setAttribute("href", url);
                    link.setAttribute("download", `PIS_Schedule_With_Brothers_${new Date().toISOString().split('T')[0]}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
                
                toast.success(`Exported ${data.length} PIS appointments with brother assignments`, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            } else {
                toast.error("Failed to export", {
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

    // ========== Edit Brother Availability Handlers ==========
    
    const openEditAvailability = (brother) => {
        setEditingBrotherAvailability(brother);
        // Convert their available timeslots to a Set of ISO strings for easy comparison
        const slots = new Set();
        if (brother.available_timeslots) {
            brother.available_timeslots.forEach(ts => {
                let isoString;
                if (ts.$date && ts.$date.$numberLong) {
                    isoString = new Date(parseInt(ts.$date.$numberLong)).toISOString();
                } else {
                    isoString = new Date(ts).toISOString();
                }
                slots.add(isoString);
            });
        }
        setEditingSlots(slots);
    };

    const closeEditAvailability = () => {
        setEditingBrotherAvailability(null);
        setEditingSlots(new Set());
    };

    const toggleEditSlot = (slotIso) => {
        const newSlots = new Set(editingSlots);
        if (newSlots.has(slotIso)) {
            newSlots.delete(slotIso);
        } else {
            newSlots.add(slotIso);
        }
        setEditingSlots(newSlots);
    };

    const selectAllEditSlots = () => {
        const allSlots = new Set(allPisTimeslots.map(slot => 
            new Date(parseInt(slot.time.$date.$numberLong)).toISOString()
        ));
        setEditingSlots(allSlots);
    };

    const clearAllEditSlots = () => {
        setEditingSlots(new Set());
    };

    const saveEditedAvailability = async () => {
        if (!editingBrotherAvailability) return;
        
        setSavingAvailability(true);
        try {
            const api = import.meta.env.VITE_API_PREFIX;
            const response = await axios.post(`${api}/brother/pis-availability/submit`, {
                brother_uid: editingBrotherAvailability.brother_uid,
                brother_email: editingBrotherAvailability.brother_email,
                brother_first_name: editingBrotherAvailability.brother_first_name,
                brother_last_name: editingBrotherAvailability.brother_last_name,
                available_timeslots: Array.from(editingSlots)
            });

            if (response.data.status === "success") {
                toast.success(`Updated availability for ${editingBrotherAvailability.brother_first_name}`, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
                
                // Refresh the availabilities list
                const availabilitiesResponse = await axios.get(`${apiBase}/pis-availability/all`);
                if (availabilitiesResponse.data.status === "success") {
                    setBrotherAvailabilities(availabilitiesResponse.data.payload);
                }
                
                closeEditAvailability();
            } else {
                toast.error(response.data.message || "Failed to update", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error("Failed to save availability", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setSavingAvailability(false);
        }
    };

    // ========== Rush App Disable Handlers ==========

    const handleToggleRushAppAccess = async (field, newValue) => {
        setRushAppLoading(true);
        
        const newStatus = {
            disable_bidcom: field === 'disable_bidcom' ? Boolean(newValue) : Boolean(rushAppStatus.disable_bidcom),
            disable_regular: field === 'disable_regular' ? Boolean(newValue) : Boolean(rushAppStatus.disable_regular),
            midterm_mode: Boolean(rushAppStatus.midterm_mode),
        };
        
        try {
            const response = await axios.post(`${apiBase}/rush-app/update`, newStatus);
            if (response.data.status === "success") {
                setRushAppStatus({
                    ...newStatus,
                    updated_by: auth.currentUser?.email || "admin"
                });
                
                const targetText = field === 'disable_bidcom' ? 'Bid Committee' : 'Regular Brothers';
                toast.success(`${targetText} access ${newValue ? 'disabled' : 'enabled'}`, {
                    position: "top-center",
                    autoClose: 2000,
                    theme: "dark",
                });
            } else {
                toast.error(response.data.message || "Failed to update settings", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error("Failed to update Rush App settings", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setRushAppLoading(false);
        }
    };

    const handleToggleMidtermMode = async (newValue) => {
        setMidtermLoading(true);

        const newStatus = {
            disable_bidcom: Boolean(rushAppStatus.disable_bidcom),
            disable_regular: Boolean(rushAppStatus.disable_regular),
            midterm_mode: Boolean(newValue),
        };

        try {
            const response = await axios.post(`${apiBase}/rush-app/update`, newStatus);
            if (response.data.status === "success") {
                setRushAppStatus({
                    ...newStatus,
                    updated_by: auth.currentUser?.email || "admin"
                });
                toast.success(`Midterm Mode ${newValue ? 'enabled' : 'disabled'}`, {
                    position: "top-center",
                    autoClose: 2000,
                    theme: "dark",
                });
            } else {
                toast.error(response.data.message || "Failed to update Midterm Mode", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error("Failed to update Midterm Mode", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setMidtermLoading(false);
        }
    };

    // ========== Comment Visibility Handlers ==========

    const handleToggleCommentVisibility = async (newValue) => {
        setCommentVisibilityLoading(true);
        
        try {
            const response = await axios.post(`${apiBase}/comment-visibility/update`, {
                require_comment_to_view: newValue
            });
            if (response.data.status === "success") {
                setCommentVisibilityStatus({
                    require_comment_to_view: newValue,
                    updated_by: auth.currentUser?.email || "admin"
                });
                
                toast.success(newValue
                    ? 'Comment viewing restricted — brothers only see their own comments'
                    : 'Comment viewing open — all brothers can read every comment',
                {
                    position: "top-center",
                    autoClose: 2000,
                    theme: "dark",
                });
            } else {
                toast.error(response.data.message || "Failed to update settings", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch (error) {
            toast.error("Failed to update comment visibility settings", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setCommentVisibilityLoading(false);
        }
    };

    const formatSlotTime = (slot) => {
        const date = new Date(parseInt(slot.time.$date.$numberLong));
        return {
            date: date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            }),
            time: date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            })
        };
    };

    // Group timeslots by date for the edit modal
    const groupedEditSlots = allPisTimeslots.reduce((groups, slot) => {
        const date = new Date(parseInt(slot.time.$date.$numberLong));
        const dateKey = date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(slot);
        return groups;
    }, {});

    if (loading) {
        return <Loader />;
    }

    return (
        <div className="min-h-screen w-full bg-white">
            {/* Edit Brother Availability Modal */}
            {editingBrotherAvailability && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={closeEditAvailability}
                    />
                    
                    {/* Modal */}
                    <div className="relative bg-white rounded-apple-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden mx-4 border border-apple-gray-200">
                        {/* Header */}
                        <div className="bg-black px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-apple-title2 font-normal text-white">
                                    Edit Availability
                                </h2>
                                <p className="text-apple-footnote text-apple-gray-400 font-light">
                                    {editingBrotherAvailability.brother_first_name} {editingBrotherAvailability.brother_last_name}
                                </p>
                            </div>
                <button
                                onClick={closeEditAvailability}
                                className="text-white/60 hover:text-white text-2xl font-light transition-colors"
                            >
                                ×
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto max-h-[55vh]">
                            {allPisTimeslots.length === 0 ? (
                                <div className="text-center py-8 text-apple-gray-500 text-apple-body font-light">
                                    No PIS timeslots available
                                </div>
                            ) : (
                                <>
                                    {/* Quick actions */}
                                    <div className="flex gap-3 mb-6">
                                        <button
                                            onClick={selectAllEditSlots}
                                            className="px-4 py-2 bg-apple-gray-100 text-black rounded-apple-lg text-apple-footnote font-light hover:bg-apple-gray-200 transition-colors border border-apple-gray-200"
                                        >
                                            Select All
                                        </button>
                                        <button
                                            onClick={clearAllEditSlots}
                                            className="px-4 py-2 bg-white text-apple-gray-600 rounded-apple-lg text-apple-footnote font-light hover:bg-apple-gray-50 transition-colors border border-apple-gray-200"
                                        >
                                            Clear All
                                        </button>
                                        <div className="ml-auto text-apple-caption1 text-apple-gray-500 self-center font-light">
                                            {editingSlots.size} of {allPisTimeslots.length} selected
                                        </div>
                                    </div>

                                    {/* Timeslots grouped by date */}
                                    <div className="space-y-6">
                                        {Object.entries(groupedEditSlots).map(([dateKey, slots]) => (
                                            <div key={dateKey}>
                                                <h3 className="text-apple-footnote font-medium text-black mb-3 border-b border-apple-gray-200 pb-2">
                                                    {dateKey}
                                                </h3>
                                                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                                    {slots.map((slot, idx) => {
                                                        const slotIso = new Date(parseInt(slot.time.$date.$numberLong)).toISOString();
                                                        const isSelected = editingSlots.has(slotIso);
                                                        const { time } = formatSlotTime(slot);
                                                        
                                                        return (
                                                            <button
                                                                key={idx}
                                                                onClick={() => toggleEditSlot(slotIso)}
                                                                className={`
                                                                    px-2 py-2 rounded-apple-lg text-apple-footnote font-light
                                                                    transition-all duration-150
                                                                    ${isSelected 
                                                                        ? 'bg-black text-white shadow-md' 
                                                                        : 'bg-apple-gray-100 text-apple-gray-700 hover:bg-apple-gray-200 border border-apple-gray-200'
                                                                    }
                                                                `}
                                                            >
                                                                {time}
                </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
            </div>

                        {/* Footer */}
                        <div className="border-t border-apple-gray-200 bg-apple-gray-50 px-6 py-4">
                            <div className="flex items-center justify-end gap-3">
                                <button
                                    onClick={closeEditAvailability}
                                    className="px-5 py-2.5 rounded-apple-xl text-apple-body font-light text-apple-gray-600 hover:bg-apple-gray-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveEditedAvailability}
                                    disabled={savingAvailability}
                                    className={`
                                        px-6 py-2.5 rounded-apple-xl text-apple-body font-light text-white
                                        transition-all duration-200
                                        ${savingAvailability
                                            ? 'bg-apple-gray-300 cursor-not-allowed'
                                            : 'bg-black hover:bg-apple-gray-800'
                                        }
                                    `}
                                >
                                    {savingAvailability ? 'Saving...' : `Save (${editingSlots.size} slots)`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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

                            {/* Export Rushee Personal Info */}
                            <div className="card-apple p-5">
                                <h3 className="text-apple-headline font-normal text-black mb-2">Rushee Personal Info</h3>
                                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                                    Export CSV with all registration info (name, GTID, email, phone, housing, major, etc.)
                                </p>
                                <button
                                    onClick={exportRusheePersonalInfo}
                                    className="w-full bg-black text-white py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-800 transition-all duration-200"
                                >
                                    Export Rushee Info
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
                                    <div className="bg-apple-gray-50 rounded-apple-lg p-4 border border-apple-gray-200 mb-3 space-y-1">
                                        <div className="text-apple-body font-medium text-black">
                                            {`${selectedBrother.firstname || selectedBrother.firstName || ""} ${selectedBrother.lastname || selectedBrother.lastName || ""}`.trim() || selectedBrother.email}
                                        </div>
                                        <div className="text-apple-caption2 text-apple-gray-600">
                                            {selectedBrother.email}
                                        </div>
                                        <div className="text-apple-caption2 flex gap-4 mt-2">
                                            <span>
                                                Admin:{" "}
                                                <span className={`font-medium ${brotherAdminStatus ? "text-green-600" : "text-apple-gray-500"}`}>
                                                    {brotherAdminStatus === null ? "..." : brotherAdminStatus ? "Yes" : "No"}
                                                </span>
                                            </span>
                                            <span>
                                                Bid Committee:{" "}
                                                <span className={`font-medium ${brotherBidcomStatus ? "text-blue-600" : "text-apple-gray-500"}`}>
                                                    {brotherBidcomStatus === null ? "..." : brotherBidcomStatus ? "Yes" : "No"}
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Admin Controls */}
                                <div className="mb-3">
                                    <div className="text-apple-caption1 font-medium text-apple-gray-600 mb-2">Admin Access</div>
                                    <div className="flex gap-3">
                <button
                                            onClick={() => handleSetAdmin(true)}
                                            disabled={isPromoting || !selectedBrother || brotherAdminStatus}
                                            className="flex-1 bg-black text-white py-2.5 px-4 rounded-apple-xl text-apple-footnote font-light hover:bg-apple-gray-800 transition-all duration-200 disabled:opacity-60"
                                        >
                                            {isPromoting ? "..." : "Grant Admin"}
                                        </button>
                                        <button
                                            onClick={() => handleSetAdmin(false)}
                                            disabled={isPromoting || !selectedBrother || !brotherAdminStatus}
                                            className="flex-1 bg-white text-black py-2.5 px-4 rounded-apple-xl text-apple-footnote font-light border border-apple-gray-200 hover:bg-apple-gray-50 transition-all duration-200 disabled:opacity-60"
                                        >
                                            {isPromoting ? "..." : "Remove Admin"}
                </button>
                                    </div>
            </div>

                                {/* Bid Committee Controls */}
                                <div>
                                    <div className="text-apple-caption1 font-medium text-apple-gray-600 mb-2">Bid Committee Access</div>
                                    <div className="flex gap-3">
                <button
                                            onClick={() => handleSetBidcom(true)}
                                            disabled={isPromoting || !selectedBrother || brotherBidcomStatus}
                                            className="flex-1 bg-blue-600 text-white py-2.5 px-4 rounded-apple-xl text-apple-footnote font-light hover:bg-blue-700 transition-all duration-200 disabled:opacity-60"
                                        >
                                            {isPromoting ? "..." : "Grant Bid Com"}
                                        </button>
                <button
                                            onClick={() => handleSetBidcom(false)}
                                            disabled={isPromoting || !selectedBrother || !brotherBidcomStatus}
                                            className="flex-1 bg-white text-black py-2.5 px-4 rounded-apple-xl text-apple-footnote font-light border border-apple-gray-200 hover:bg-apple-gray-50 transition-all duration-200 disabled:opacity-60"
                                        >
                                            {isPromoting ? "..." : "Remove Bid Com"}
                </button>
            </div>
                                </div>
            </div>

                            {/* Rush App Control */}
                            <div className="card-apple p-5">
                                <h3 className="text-apple-headline font-normal text-black mb-2">Rush App Access</h3>
                                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                                    Disable login for specific groups. Admins always have access.
                                </p>

                                <div className="space-y-4">
                                    {/* Bid Committee Toggle */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-apple-body font-normal text-black">Bid Committee</div>
                                            <div className="text-apple-caption2 text-apple-gray-500">Members with bid committee access</div>
                                        </div>
                                        <button
                                            onClick={() => handleToggleRushAppAccess('disable_bidcom', !rushAppStatus.disable_bidcom)}
                                            disabled={rushAppLoading}
                                            className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                                                rushAppStatus.disable_bidcom ? 'bg-black' : 'bg-apple-gray-300'
                                            } ${rushAppLoading ? 'opacity-50' : ''}`}
                                        >
                                            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                                                rushAppStatus.disable_bidcom ? 'translate-x-5' : 'translate-x-0.5'
                                            }`} />
                                        </button>
                                    </div>

                                    {/* Regular Brothers Toggle */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-apple-body font-normal text-black">Regular Brothers</div>
                                            <div className="text-apple-caption2 text-apple-gray-500">Brothers without admin or bid committee</div>
                                        </div>
                                        <button
                                            onClick={() => handleToggleRushAppAccess('disable_regular', !rushAppStatus.disable_regular)}
                                            disabled={rushAppLoading}
                                            className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                                                rushAppStatus.disable_regular ? 'bg-black' : 'bg-apple-gray-300'
                                            } ${rushAppLoading ? 'opacity-50' : ''}`}
                                        >
                                            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                                                rushAppStatus.disable_regular ? 'translate-x-5' : 'translate-x-0.5'
                                            }`} />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-apple-gray-100">
                                    <div className="text-apple-caption2 text-apple-gray-400">
                                        {(rushAppStatus.disable_bidcom || rushAppStatus.disable_regular) 
                                            ? `Disabled: ${[
                                                rushAppStatus.disable_bidcom && 'Bid Committee',
                                                rushAppStatus.disable_regular && 'Regular Brothers'
                                            ].filter(Boolean).join(', ')}`
                                            : 'All brothers can access the app'
                                        }
                                    </div>
                                </div>
                            </div>

                            {/* Comment Visibility Control */}
                            <div className="card-apple p-5">
                                <h3 className="text-apple-headline font-normal text-black mb-2">Comment Visibility</h3>
                                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                                    Control whether brothers can read every comment on a rushee, or only their own.
                                    Turn this on before voting so brothers can read all comments even if they did not post one.
                                </p>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-apple-body font-normal text-black">Show All Comments to Brothers</div>
                                        <div className="text-apple-caption2 text-apple-gray-500">
                                            {commentVisibilityStatus.require_comment_to_view
                                                ? 'Off — brothers only see their own comments (rush mode)'
                                                : 'On — every brother can read all comments (voting mode)'
                                            }
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleToggleCommentVisibility(!commentVisibilityStatus.require_comment_to_view)}
                                        disabled={commentVisibilityLoading}
                                        className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                                            !commentVisibilityStatus.require_comment_to_view ? 'bg-black' : 'bg-apple-gray-300'
                                        } ${commentVisibilityLoading ? 'opacity-50' : ''}`}
                                    >
                                        <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                                            !commentVisibilityStatus.require_comment_to_view ? 'translate-x-5' : 'translate-x-0.5'
                                        }`} />
                                    </button>
                                </div>

                                <div className="mt-4 pt-3 border-t border-apple-gray-100">
                                    <div className="text-apple-caption2 text-apple-gray-400">
                                        {commentVisibilityStatus.require_comment_to_view
                                            ? 'Rush mode — brothers only see their own comments'
                                            : 'Voting mode — all brothers can see all comments without posting'
                                        }
                                    </div>
                                </div>
                            </div>

                            {/* Midterm Mode Control */}
                            <div className="card-apple p-5">
                                <h3 className="text-apple-headline font-normal text-black mb-2">Midterm Mode</h3>
                                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                                    Strips the app to voting-only for all brothers. Admins retain full access. The navbar title changes to "AKPsi Midterm" and the contact bar is hidden.
                                </p>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-apple-body font-normal text-black">Midterm Mode</div>
                                        <div className="text-apple-caption2 text-apple-gray-500">Brothers see only the voting page</div>
                                    </div>
                                    <button
                                        onClick={() => handleToggleMidtermMode(!rushAppStatus.midterm_mode)}
                                        disabled={midtermLoading}
                                        className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                                            rushAppStatus.midterm_mode ? 'bg-black' : 'bg-apple-gray-300'
                                        } ${midtermLoading ? 'opacity-50' : ''}`}
                                    >
                                        <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                                            rushAppStatus.midterm_mode ? 'translate-x-5' : 'translate-x-0.5'
                                        }`} />
                                    </button>
                                </div>

                                <div className="mt-4 pt-3 border-t border-apple-gray-100">
                                    <div className="text-apple-caption2 text-apple-gray-400">
                                        {rushAppStatus.midterm_mode
                                            ? 'Midterm Mode is active — brothers see voting only'
                                            : 'Normal mode — full app is available to brothers'
                                        }
                                    </div>
                                </div>
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
                <input
                    type="number"
                                        placeholder="Question order (e.g., 1)"
                                        className="input-apple text-apple-body"
                    value={questionOrder}
                    onChange={(e) => {
                        const value = e.target.value;
                        setQuestionOrder(value === "" ? "" : Number(value));
                    }}
                />
                <input
                    type="text"
                                        placeholder="Category (leave blank for a fixed, always-shown question)"
                                        className="input-apple text-apple-body"
                    value={questionCategory}
                    onChange={(e) => setQuestionCategory(e.target.value)}
                />
                <p className="text-apple-caption text-apple-gray-400">
                    Questions with the same category form a random-draw bucket &mdash; one is randomly picked per category, per rushee, 5 minutes before their PIS. Leave category blank for logistics/MC questions or anything that should always be asked.
                </p>
                                </div>
                                <div className="flex gap-3">
                <button
                                        onClick={async () => {
                                            const order = questionOrder === "" ? undefined : Number(questionOrder);
                                            const category = questionCategory.trim() === "" ? undefined : questionCategory.trim();
                                            await handleRequest("add_pis_question", { question, question_type: questionType, order, category }, "post", "Question added!");
                                            fetchPisQuestions();
                                        }}
                                        className="flex-1 bg-black text-white py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-800 transition-all duration-200"
                                    >
                                        Add Question
                </button>
                <button
                                        onClick={async () => {
                                            await handleRequest("delete_pis_question", { question, question_type: questionType }, "post", "Question deleted!");
                                            fetchPisQuestions();
                                        }}
                                        className="flex-1 bg-white text-red-600 py-3 px-4 rounded-apple-xl text-apple-body font-light border border-red-200 hover:bg-red-50 transition-all duration-200"
                >
                    Delete Question
                </button>
            </div>

                                {/* Question bank with category assignment */}
                                <div className="mt-6 pt-6 border-t border-apple-gray-200">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-apple-body font-normal text-black">Question Bank &amp; Categories</h4>
                                        <button
                                            onClick={fetchPisQuestions}
                                            className="text-apple-caption text-apple-gray-500 hover:text-black transition-colors"
                                        >
                                            {pisQuestionsLoading ? "Refreshing..." : "Refresh"}
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                        {pisQuestions.map((q, idx) => (
                                            <div key={idx} className="flex items-center gap-2 p-3 bg-apple-gray-50 rounded-apple-lg">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-apple-body text-black truncate">{q.question}</p>
                                                    <p className="text-apple-caption text-apple-gray-400">{q.question_type} &middot; order {q.order ?? "—"}</p>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Fixed (no category)"
                                                    className="input-apple text-apple-caption w-48"
                                                    value={categoryEdits[q.question] ?? q.category ?? ""}
                                                    onChange={(e) => setCategoryEdits((prev) => ({ ...prev, [q.question]: e.target.value }))}
                                                />
                                                <button
                                                    onClick={() => saveQuestionCategory(q)}
                                                    className="text-apple-caption bg-black text-white px-3 py-2 rounded-apple-lg hover:bg-apple-gray-800 transition-colors whitespace-nowrap"
                                                >
                                                    Save
                                                </button>
                                            </div>
                                        ))}
                                        {pisQuestions.length === 0 && !pisQuestionsLoading && (
                                            <p className="text-apple-caption text-apple-gray-400">No PIS questions yet.</p>
                                        )}
                                    </div>
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

                    {/* Divider */}
                    <div className="border-t border-apple-gray-200 my-10"></div>

                    {/* PIS Availability System Section */}
                    <div>
                        <h2 className="text-apple-title2 font-normal text-black mb-4">PIS Brother Availability</h2>
                        <p className="text-apple-footnote text-apple-gray-600 font-light mb-6">
                            Send availability form to brothers, auto-assign them to PIS slots, and export schedules
                        </p>

                        <div className="space-y-6">
                            {/* Form Status Card */}
                            <div className="card-apple p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-apple-headline font-normal text-black">Availability Form</h3>
                                    <div className={`px-3 py-1 rounded-full text-apple-caption1 font-medium ${
                                        pisFormStatus.is_active 
                                            ? 'bg-black text-white' 
                                            : 'bg-apple-gray-100 text-apple-gray-600'
                                    }`}>
                                        {pisFormStatus.is_active ? 'Active' : 'Inactive'}
                                    </div>
                                </div>
                                
                                {pisFormStatus.sent_at && (
                                    <p className="text-apple-caption2 text-apple-gray-500 mb-4">
                                        Last sent: {new Date(pisFormStatus.sent_at.$date ? 
                                            parseInt(pisFormStatus.sent_at.$date.$numberLong) : 
                                            pisFormStatus.sent_at
                                        ).toLocaleString()}
                                    </p>
                                )}

                                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                                    When active, brothers will be prompted to fill out their availability before accessing the app.
                                </p>

                                <div className="flex flex-wrap gap-3">
                                    {!pisFormStatus.is_active ? (
                <button
                                            onClick={handleSendPISForm}
                                            disabled={pisFormLoading}
                                            className="flex-1 bg-black text-white py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-800 transition-all duration-200 disabled:opacity-60"
                >
                                            {pisFormLoading ? 'Sending...' : 'Send Form to All Brothers'}
                </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={handleDeactivatePISForm}
                                                disabled={pisFormLoading}
                                                className="flex-1 bg-apple-gray-100 text-apple-gray-700 py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-200 transition-all duration-200 disabled:opacity-60 border border-apple-gray-200"
                                            >
                                                {pisFormLoading ? '...' : 'Deactivate Form'}
                                            </button>
                                            <button
                                                onClick={handleClearAndResendPISForm}
                                                disabled={pisFormLoading}
                                                className="flex-1 bg-white text-red-600 py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-red-50 transition-all duration-200 disabled:opacity-60 border border-red-200"
                                            >
                                                {pisFormLoading ? '...' : 'Clear & Resend'}
                                            </button>
                                        </>
                                    )}
                                </div>
            </div>

                            {/* Submissions Status */}
                            <div className="card-apple p-6">
                                <h3 className="text-apple-headline font-normal text-black mb-2">Submissions</h3>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="text-3xl font-light text-black">
                                        {brotherAvailabilities.length}
                                    </div>
                                    <div className="text-apple-footnote text-apple-gray-600 font-light">
                                        brothers have submitted their availability
                                    </div>
                                </div>
                                
                                <p className="text-apple-caption2 text-apple-gray-500 mb-3 font-light">
                                    Click on a name to edit their availability
                                </p>
                                
                                {brotherAvailabilities.length > 0 && (
                                    <div className="bg-apple-gray-50 rounded-apple-lg p-3 max-h-48 overflow-y-auto border border-apple-gray-100">
                                        <div className="flex flex-wrap gap-2">
                                            {brotherAvailabilities.map((avail, idx) => (
                <button
                                                    key={idx}
                                                    onClick={() => openEditAvailability(avail)}
                                                    className="text-apple-caption1 bg-white px-3 py-1.5 rounded-apple border border-apple-gray-200 text-apple-gray-700 hover:bg-apple-gray-100 hover:border-apple-gray-300 transition-all cursor-pointer font-light"
                                                >
                                                    {avail.brother_first_name} {avail.brother_last_name}
                                                    <span className="ml-1 text-apple-gray-400">
                                                        ({avail.available_timeslots?.length || 0})
                                                    </span>
                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
            </div>

                            {/* Auto-Assignment */}
                            <div className="card-apple p-6">
                                <h3 className="text-apple-headline font-normal text-black mb-2">Auto-Assign Brothers</h3>
                                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                                    Automatically assign 2 available brothers to each rushee's PIS slot based on submitted availability.
                                    Brothers are load-balanced to distribute assignments evenly.
                                </p>

                                <div className="flex flex-wrap gap-3">
                <button
                                        onClick={handleAutoAssignBrothers}
                                        disabled={pisFormLoading || brotherAvailabilities.length === 0}
                                        className={`flex-1 py-3 px-4 rounded-apple-xl text-apple-body font-light transition-all duration-200 ${
                                            brotherAvailabilities.length > 0
                                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        } disabled:opacity-60`}
                                    >
                                        {pisFormLoading ? '...' : 'Auto-Assign Brothers'}
                                    </button>
                                    <button
                                        onClick={handleClearAssignments}
                                        disabled={pisFormLoading}
                                        className="flex-1 bg-white text-red-600 py-3 px-4 rounded-apple-xl text-apple-body font-light border border-red-200 hover:bg-red-50 transition-all duration-200 disabled:opacity-60"
                                    >
                                        {pisFormLoading ? '...' : 'Clear All Assignments'}
                </button>
                                </div>
            </div>

                            {/* Export with Brothers */}
                            <div className="card-apple p-6">
                                <h3 className="text-apple-headline font-normal text-black mb-2">Export Full Schedule</h3>
                                <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                                    Export CSV with rushee names, timeslots, and assigned brothers (sorted chronologically)
                                </p>
                                <button
                                    onClick={exportPISWithBrothers}
                                    className="w-full bg-black text-white py-3 px-4 rounded-apple-xl text-apple-body font-light hover:bg-apple-gray-800 transition-all duration-200"
                                >
                                    Export PIS Schedule with Brothers
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
