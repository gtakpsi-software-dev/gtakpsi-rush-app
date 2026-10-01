import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { verifyUser } from "../features/auth/verifyUser";
import Navbar from "../components/Navbar";
import { loadAdminData } from "../features/admin/bootstrap/loadAdminData";
import Loader from "../components/Loader";
import AvailabilityEditorModal from "../features/admin/availability/AvailabilityEditorModal";
import useAdminAvailabilityEditor from "../features/admin/availability/useAdminAvailabilityEditor";
import PisAvailabilitySection from "../features/admin/availability/PisAvailabilitySection";
import { createAvailabilityFormActions } from "../features/admin/availability/availabilityFormActions";
import { createQuestionActions } from "../features/admin/pis/questionActions";
import {
    formatCurrentPISTime,
    formatSlotTime,
    formatTimeslot,
} from "../features/admin/pis/pisTime";
import { createRescheduleActions } from "../features/admin/pis/rescheduleActions";
import { createAdminDataActions } from "../features/admin/data/dataActionHandlers";
import { downloadCsv } from "../features/admin/data/downloadCsv";
import { createPromotionActions } from "../features/admin/access/promotionActions";
import useAdminAccessSettings from "../features/admin/access/useAdminAccessSettings";
import { useAdminSearch } from "../features/admin/search/useAdminSearch";
import AdminExportsAccessSection from "../features/admin/overview/AdminExportsAccessSection";
import AdminManagementSection from "../features/admin/overview/AdminManagementSection";
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
    const [selectedBrother, setSelectedBrother] = useState(null);
    const [isPromoting, setIsPromoting] = useState(false);
    const [brotherAdminStatus, setBrotherAdminStatus] = useState(null); // true/false/null
    const [brotherBidcomStatus, setBrotherBidcomStatus] = useState(null); // true/false/null

    // Reschedule PIS state
    const [rushees, setRushees] = useState([]);
    const [selectedRushee, setSelectedRushee] = useState(null);
    const [availableTimeslots, setAvailableTimeslots] = useState([]);
    const [selectedNewTimeslot, setSelectedNewTimeslot] = useState("");

    // PIS Availability Form state
    const [pisFormStatus, setPisFormStatus] = useState({ is_active: false, sent_at: null });
    const [pisFormLoading, setPisFormLoading] = useState(false);
    const [brotherAvailabilities, setBrotherAvailabilities] = useState([]);
    
    const {
        editingBrotherAvailability,
        editingSlots,
        allPisTimeslots,
        setAllPisTimeslots,
        savingAvailability,
        groupedEditSlots,
        openEditAvailability,
        closeEditAvailability,
        toggleEditSlot,
        selectAllEditSlots,
        clearAllEditSlots,
        saveEditedAvailability,
    } = useAdminAvailabilityEditor({
        apiBase,
        getApiPrefix: () => import.meta.env.VITE_API_PREFIX,
        setBrotherAvailabilities,
        axios,
        toast,
    });

    const {
        rushAppStatus,
        setRushAppStatus,
        rushAppLoading,
        midtermLoading,
        commentVisibilityStatus,
        setCommentVisibilityStatus,
        commentVisibilityLoading,
        handleToggleRushAppAccess,
        handleToggleMidtermMode,
        handleToggleCommentVisibility,
    } = useAdminAccessSettings({ apiBase, axios, toast, auth });

    const navigate = useNavigate();

    const errorTitle = "Invalid User Credentials";
    const errorDescription = "If this is a mistake, try logging back in";

    useEffect(() => {
        if (loading === true) {
            loadAdminData({
                verifyUser,
                navigate,
                errorTitle,
                errorDescription,
                auth,
                allowlist,
                axios,
                db,
                collection,
                getDocs,
                apiBase,
                rusheeApiBase,
                toast,
                logError: (message, error) => console.error(message, error),
                setBrothers,
                setRushees,
                setAvailableTimeslots,
                setPisFormStatus,
                setBrotherAvailabilities,
                setAllPisTimeslots,
                setRushAppStatus,
                setCommentVisibilityStatus,
                setLoading,
            });
        }
    }, [loading, navigate, rusheeApiBase]);

    const { fetchPisQuestions, saveQuestionCategory } = createQuestionActions({
        apiBase,
        categoryEdits,
        setPisQuestions,
        setPisQuestionsLoading,
        axios,
        toast,
    });

    useEffect(() => {
        fetchPisQuestions();
    }, []);

    const {
        rusheeSearch,
        setRusheeSearch,
        filteredRushees,
        setFilteredRushees,
        brotherSearch,
        setBrotherSearch,
        filteredBrothers,
        setFilteredBrothers,
    } = useAdminSearch({ brothers, rushees });

    const {
        handleRequest,
        exportRusheePersonalInfo,
        exportRusheeNumbers,
        exportPISSchedule,
        exportPISWithBrothers,
    } = createAdminDataActions({
        apiBase,
        getApiPrefix: () => import.meta.env.VITE_API_PREFIX,
        axios,
        toast,
        download: downloadCsv,
    });

    const { handleSelectRushee, handleReschedulePIS } = createRescheduleActions({
        rusheeApiBase,
        selectedRushee,
        selectedNewTimeslot,
        setSelectedRushee,
        setRusheeSearch,
        setFilteredRushees,
        setSelectedNewTimeslot,
        setAvailableTimeslots,
        axios,
        toast,
        logError: (message, error) => console.error(message, error),
    });

    const {
        handleSelectBrother,
        handleSetAdmin,
        handleSetBidcom,
    } = createPromotionActions({
        apiBase,
        selectedBrother,
        setSelectedBrother,
        setBrotherSearch,
        setFilteredBrothers,
        setBrotherAdminStatus,
        setBrotherBidcomStatus,
        setIsPromoting,
        axios,
        toast,
    });

    const {
        handleSendPISForm,
        handleClearAndResendPISForm,
        handleDeactivatePISForm,
        handleAutoAssignBrothers,
        handleClearAssignments,
    } = createAvailabilityFormActions({
        apiBase,
        pisFormStatus,
        setPisFormStatus,
        setPisFormLoading,
        setBrotherAvailabilities,
        axios,
        toast,
        confirm: (message) => window.confirm(message),
    });

    if (loading) {
        return <Loader />;
    }

    return (
        <div className="min-h-screen w-full bg-white">
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
                    <div className="mb-8">
                        <h1 className="text-apple-large font-light text-black">Admin Panel</h1>
                        <p className="text-apple-body text-apple-gray-600 font-light mt-2">
                            Manage PIS questions, timeslots, and rush nights
                        </p>
                    </div>

                    <AdminExportsAccessSection {...{
                        exportRusheeNumbers, exportPISSchedule, exportRusheePersonalInfo, handleRequest,
                        brotherSearch, setBrotherSearch, selectedBrother, setSelectedBrother,
                        filteredBrothers, handleSelectBrother, brotherAdminStatus, brotherBidcomStatus,
                        isPromoting, handleSetAdmin, handleSetBidcom, rushAppStatus,
                        rushAppLoading, handleToggleRushAppAccess, commentVisibilityStatus, commentVisibilityLoading,
                        handleToggleCommentVisibility, midtermLoading, handleToggleMidtermMode,
                    }} />

                    <div className="border-t border-apple-gray-200 my-10"></div>

                    <AdminManagementSection {...{
                        question, setQuestion, questionType, setQuestionType, questionOrder,
                        setQuestionOrder, questionCategory, setQuestionCategory, handleRequest,
                        fetchPisQuestions, pisQuestions, pisQuestionsLoading, categoryEdits,
                        setCategoryEdits, saveQuestionCategory, timeslotTime, setTimeslotTime,
                        timeslotChange, setTimeslotChange, rushNightName, setRushNightName,
                        rushNightTime, setRushNightTime, rusheeSearch, setRusheeSearch,
                        selectedRushee, setSelectedRushee, filteredRushees, handleSelectRushee,
                        formatCurrentPISTime, selectedNewTimeslot, setSelectedNewTimeslot,
                        availableTimeslots, formatTimeslot, handleReschedulePIS,
                    }} />

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
