import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { verifyUser } from "../js/verifications";
import Navbar from "../components/Navbar";
import { loadAdminData } from "../features/admin/bootstrap/loadAdminData";
import Loader from "../components/Loader";
import AvailabilityEditorModal from "../features/admin/availability/AvailabilityEditorModal";
import { createAvailabilityEditorActions } from "../features/admin/availability/availabilityEditorActions";
import PisAvailabilitySection from "../features/admin/availability/PisAvailabilitySection";
import { createAvailabilityFormActions } from "../features/admin/availability/availabilityFormActions";
import PisQuestionsCard from "../features/admin/pis/PisQuestionsCard";
import { createQuestionActions } from "../features/admin/pis/questionActions";
import {
    formatCurrentPISTime,
    formatSlotTime,
    formatTimeslot,
    groupEditSlots,
} from "../features/admin/pis/pisTime";
import ReschedulePisCard from "../features/admin/pis/ReschedulePisCard";
import { createRescheduleActions } from "../features/admin/pis/rescheduleActions";
import AdminSchedulingCards from "../features/admin/scheduling/AdminSchedulingCards";
import AdminDataActions from "../features/admin/data/AdminDataActions";
import { createAdminDataActions } from "../features/admin/data/dataActionHandlers";
import { downloadCsv } from "../features/admin/data/downloadCsv";
import AdminAccessCard from "../features/admin/access/AdminAccessCard";
import { createPromotionActions } from "../features/admin/access/promotionActions";
import AccessSettingsCards from "../features/admin/access/AccessSettingsCards";
import { createAccessSettingsActions } from "../features/admin/access/accessSettingsActions";
import { useAdminSearch } from "../features/admin/search/useAdminSearch";
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

    const {
        openEditAvailability,
        closeEditAvailability,
        toggleEditSlot,
        selectAllEditSlots,
        clearAllEditSlots,
        saveEditedAvailability,
    } = createAvailabilityEditorActions({
        apiBase,
        getApiPrefix: () => import.meta.env.VITE_API_PREFIX,
        editingBrotherAvailability,
        editingSlots,
        allPisTimeslots,
        setEditingBrotherAvailability,
        setEditingSlots,
        setSavingAvailability,
        setBrotherAvailabilities,
        axios,
        toast,
    });

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

    const groupedEditSlots = groupEditSlots(allPisTimeslots);

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
