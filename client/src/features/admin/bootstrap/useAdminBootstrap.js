import { useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { collection, getDocs } from "firebase/firestore";

import { verifyUser } from "../../auth/verifyUser";
import { auth, db } from "../../../firebase";
import { loadAdminData } from "./loadAdminData";

/**
 * Admin Bootstrap Summary:
 * - Keeps authorization and initial section reads with the bootstrap service.
 * - Retains the original effect dependencies and setter/request order.
 * - The authorization gate still runs before data is exposed to the page.
 */
export default function useAdminBootstrap({
    loading,
    navigate,
    allowlist,
    apiBase,
    rusheeApiBase,
    setBrothers,
    setRushees,
    setAvailableTimeslots,
    setPisFormStatus,
    setBrotherAvailabilities,
    setAllPisTimeslots,
    setRushAppStatus,
    setCommentVisibilityStatus,
    setLoading,
}) {
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
}
