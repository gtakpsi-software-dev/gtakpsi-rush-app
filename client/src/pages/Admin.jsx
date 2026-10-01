import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import useAdminBootstrap from "../features/admin/bootstrap/useAdminBootstrap";
import Loader from "../components/Loader";
import useAdminAvailabilityEditor from "../features/admin/availability/useAdminAvailabilityEditor";
import useAdminAvailabilityForm from "../features/admin/availability/useAdminAvailabilityForm";
import {
    formatCurrentPISTime,
    formatSlotTime,
    formatTimeslot,
} from "../features/admin/pis/pisTime";
import { createRescheduleActions } from "../features/admin/pis/rescheduleActions";
import { createAdminDataActions } from "../features/admin/data/dataActionHandlers";
import { downloadCsv } from "../features/admin/data/downloadCsv";
import useAdminPromotion from "../features/admin/access/useAdminPromotion";
import useAdminAccessSettings from "../features/admin/access/useAdminAccessSettings";
import { useAdminSearch } from "../features/admin/search/useAdminSearch";
import AdminPageView from "../features/admin/overview/AdminPageView";
import useAdminManagementInputs from "../features/admin/overview/useAdminManagementInputs";
import { auth } from "../firebase";
import { parseAdminAllowlist } from "../features/auth/parseAdminAllowlist";

export default function Admin() {
    const apiBase = import.meta.env.VITE_API_PREFIX + "/admin";
    const rusheeApiBase = import.meta.env.VITE_API_PREFIX + "/rushee";
    const allowlist = parseAdminAllowlist(import.meta.env.VITE_ADMIN_ALLOWLIST);

    const [loading, setLoading] = useState(true);

    const [brothers, setBrothers] = useState([]);

    // Reschedule PIS state
    const [rushees, setRushees] = useState([]);
    const [selectedRushee, setSelectedRushee] = useState(null);
    const [availableTimeslots, setAvailableTimeslots] = useState([]);
    const [selectedNewTimeslot, setSelectedNewTimeslot] = useState("");

    const availabilityForm = useAdminAvailabilityForm({
        apiBase, axios, toast, confirm: (message) => window.confirm(message),
    });
    
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
        setBrotherAvailabilities: availabilityForm.setBrotherAvailabilities,
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

    useAdminBootstrap({
        loading,
        navigate,
        allowlist,
        apiBase,
        rusheeApiBase,
        setBrothers,
        setRushees,
        setAvailableTimeslots,
        setPisFormStatus: availabilityForm.setPisFormStatus,
        setBrotherAvailabilities: availabilityForm.setBrotherAvailabilities,
        setAllPisTimeslots,
        setRushAppStatus,
        setCommentVisibilityStatus,
        setLoading,
    });

    const managementInputs = useAdminManagementInputs({ apiBase, axios, toast });

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
        selectedBrother,
        setSelectedBrother,
        isPromoting,
        brotherAdminStatus,
        brotherBidcomStatus,
        handleSelectBrother,
        handleSetAdmin,
        handleSetBidcom,
    } = useAdminPromotion({
        apiBase,
        setBrotherSearch,
        setFilteredBrothers,
        axios,
        toast,
    });

    if (loading) {
        return <Loader />;
    }

    return <AdminPageView
        editor={{
            editingBrotherAvailability, allPisTimeslots, groupedEditSlots,
            editingSlots, savingAvailability, formatSlotTime,
            onClose: closeEditAvailability, onSelectAll: selectAllEditSlots,
            onClearAll: clearAllEditSlots, onToggleSlot: toggleEditSlot,
            onSave: saveEditedAvailability,
        }}
        exportsAccess={{
            exportRusheeNumbers, exportPISSchedule, exportRusheePersonalInfo, handleRequest,
            brotherSearch, setBrotherSearch, selectedBrother, setSelectedBrother,
            filteredBrothers, handleSelectBrother, brotherAdminStatus, brotherBidcomStatus,
            isPromoting, handleSetAdmin, handleSetBidcom, rushAppStatus,
            rushAppLoading, handleToggleRushAppAccess, commentVisibilityStatus,
            commentVisibilityLoading, handleToggleCommentVisibility, midtermLoading,
            handleToggleMidtermMode,
        }}
        management={{
            ...managementInputs, handleRequest, rusheeSearch, setRusheeSearch,
            selectedRushee, setSelectedRushee, filteredRushees, handleSelectRushee,
            formatCurrentPISTime, selectedNewTimeslot, setSelectedNewTimeslot,
            availableTimeslots, formatTimeslot, handleReschedulePIS,
        }}
        availability={{
            ...availabilityForm.view, openEditAvailability, exportPISWithBrothers,
        }}
    />;
}
