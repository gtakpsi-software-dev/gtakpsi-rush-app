import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { verifyUser } from "../js/verifications";
import Navbar from "../components/Navbar";
import Loader from "../components/Loader";
import AvailabilityEditorModal from "../features/admin/availability/AvailabilityEditorModal";
import PisAvailabilitySection from "../features/admin/availability/PisAvailabilitySection";
import PisQuestionsCard from "../features/admin/pis/PisQuestionsCard";
import ReschedulePisCard from "../features/admin/pis/ReschedulePisCard";
import AdminSchedulingCards from "../features/admin/scheduling/AdminSchedulingCards";
import AdminDataActions from "../features/admin/data/AdminDataActions";
import {
    buildRusheePersonalInfoCsv,
    buildRusheeNumbersCsv,
    buildPisScheduleCsv,
    buildPisScheduleWithBrothersCsv,
} from "../features/admin/data/exportCsv";
import { downloadCsv } from "../features/admin/data/downloadCsv";
import AdminAccessCard from "../features/admin/access/AdminAccessCard";
import AccessSettingsCards from "../features/admin/access/AccessSettingsCards";
import { createAccessSettingsActions } from "../features/admin/access/accessSettingsActions";
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
        } catch {
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

                const csvContent = buildRusheePersonalInfoCsv(rushees);
                downloadCsv(csvContent, "Rushee_Personal_Info");

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

                const csvContent = buildRusheeNumbersCsv(mappings);
                downloadCsv(csvContent, "Rushee_Numbers");

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
        } catch {
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
        } catch {
            return "Not scheduled";
        }
      };

    const exportPISSchedule = async () => {
        try {
            const api = import.meta.env.VITE_API_PREFIX;
            const response = await axios.get(`${api}/rushee/get-timeslots`);
            
            if (response.data.status === "success") {
                const timeslots = response.data.payload;
                
                const csvContent = buildPisScheduleCsv(timeslots);
                downloadCsv(csvContent, "PIS_Schedule");
                
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
        } catch {
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
        } catch {
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
        } catch {
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
        } catch {
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
        } catch {
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
                
                const csvContent = buildPisScheduleWithBrothersCsv(data);
                downloadCsv(csvContent, "PIS_Schedule_With_Brothers");
                
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
        } catch {
            toast.error("Failed to save availability", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setSavingAvailability(false);
        }
    };

    const {
        handleToggleRushAppAccess,
        handleToggleMidtermMode,
        handleToggleCommentVisibility,
    } = createAccessSettingsActions({
        apiBase,
        rushAppStatus,
        setRushAppStatus,
        setRushAppLoading,
        setMidtermLoading,
        setCommentVisibilityStatus,
        setCommentVisibilityLoading,
        axios,
        toast,
        auth,
    });

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
                <AvailabilityEditorModal
                    editingBrotherAvailability={editingBrotherAvailability}
                    allPisTimeslots={allPisTimeslots}
                    groupedEditSlots={groupedEditSlots}
                    editingSlots={editingSlots}
                    savingAvailability={savingAvailability}
                    formatSlotTime={formatSlotTime}
                    onClose={closeEditAvailability}
                    onSelectAll={selectAllEditSlots}
                    onClearAll={clearAllEditSlots}
                    onToggleSlot={toggleEditSlot}
                    onSave={saveEditedAvailability}
                />
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
                            {/* Export and fetch actions */}
                            <AdminDataActions
                                exportRusheeNumbers={exportRusheeNumbers}
                                exportPISSchedule={exportPISSchedule}
                                exportRusheePersonalInfo={exportRusheePersonalInfo}
                                handleRequest={handleRequest}
                            />

                            {/* Admin Access */}
                            <AdminAccessCard
                                brotherSearch={brotherSearch}
                                setBrotherSearch={setBrotherSearch}
                                selectedBrother={selectedBrother}
                                setSelectedBrother={setSelectedBrother}
                                filteredBrothers={filteredBrothers}
                                handleSelectBrother={handleSelectBrother}
                                brotherAdminStatus={brotherAdminStatus}
                                brotherBidcomStatus={brotherBidcomStatus}
                                isPromoting={isPromoting}
                                handleSetAdmin={handleSetAdmin}
                                handleSetBidcom={handleSetBidcom}
                            />

                            {/* Rush App Control */}
                            <AccessSettingsCards
                                rushAppStatus={rushAppStatus}
                                rushAppLoading={rushAppLoading}
                                handleToggleRushAppAccess={handleToggleRushAppAccess}
                                commentVisibilityStatus={commentVisibilityStatus}
                                commentVisibilityLoading={commentVisibilityLoading}
                                handleToggleCommentVisibility={handleToggleCommentVisibility}
                                midtermLoading={midtermLoading}
                                handleToggleMidtermMode={handleToggleMidtermMode}
                            />
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-apple-gray-200 my-10"></div>

                    {/* Add/Delete Section */}
                    <div>
                        <h2 className="text-apple-title2 font-normal text-black mb-4">Manage Data</h2>

                        <div className="space-y-6">
                            {/* PIS Questions */}
                            <PisQuestionsCard
                                question={question}
                                setQuestion={setQuestion}
                                questionType={questionType}
                                setQuestionType={setQuestionType}
                                questionOrder={questionOrder}
                                setQuestionOrder={setQuestionOrder}
                                questionCategory={questionCategory}
                                setQuestionCategory={setQuestionCategory}
                                handleRequest={handleRequest}
                                fetchPisQuestions={fetchPisQuestions}
                                pisQuestions={pisQuestions}
                                pisQuestionsLoading={pisQuestionsLoading}
                                categoryEdits={categoryEdits}
                                setCategoryEdits={setCategoryEdits}
                                saveQuestionCategory={saveQuestionCategory}
                            />

                            {/* PIS Timeslots and Rush Nights */}
                            <AdminSchedulingCards
                                timeslotTime={timeslotTime}
                                setTimeslotTime={setTimeslotTime}
                                timeslotChange={timeslotChange}
                                setTimeslotChange={setTimeslotChange}
                                rushNightName={rushNightName}
                                setRushNightName={setRushNightName}
                                rushNightTime={rushNightTime}
                                setRushNightTime={setRushNightTime}
                                handleRequest={handleRequest}
                            />

                            {/* Reschedule PIS */}
                            <ReschedulePisCard
                                rusheeSearch={rusheeSearch}
                                setRusheeSearch={setRusheeSearch}
                                selectedRushee={selectedRushee}
                                setSelectedRushee={setSelectedRushee}
                                filteredRushees={filteredRushees}
                                handleSelectRushee={handleSelectRushee}
                                formatCurrentPISTime={formatCurrentPISTime}
                                selectedNewTimeslot={selectedNewTimeslot}
                                setSelectedNewTimeslot={setSelectedNewTimeslot}
                                availableTimeslots={availableTimeslots}
                                formatTimeslot={formatTimeslot}
                                handleReschedulePIS={handleReschedulePIS}
                            />
                        </div>
            </div>

                    {/* Divider */}
                    <div className="border-t border-apple-gray-200 my-10"></div>

                    <PisAvailabilitySection
                        pisFormStatus={pisFormStatus}
                        pisFormLoading={pisFormLoading}
                        brotherAvailabilities={brotherAvailabilities}
                        handleSendPISForm={handleSendPISForm}
                        handleDeactivatePISForm={handleDeactivatePISForm}
                        handleClearAndResendPISForm={handleClearAndResendPISForm}
                        openEditAvailability={openEditAvailability}
                        handleAutoAssignBrothers={handleAutoAssignBrothers}
                        handleClearAssignments={handleClearAssignments}
                        exportPISWithBrothers={exportPISWithBrothers}
                    />
                </div>
            </div>
        </div>
    );
}
