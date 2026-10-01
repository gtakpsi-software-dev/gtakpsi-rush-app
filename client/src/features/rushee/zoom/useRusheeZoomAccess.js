import { useEffect, useState } from "react";
import axios from "axios";

import { auth } from "../../../firebase";
import { getVisibleComments, hasOwnComment, shouldShowAllComments } from "../../comments/commentVisibility";
import { verifyUser } from "../../auth/verifyUser";
import { loadRusheeZoom } from "./loadRusheeZoom";

/**
 * Rushee Zoom Access Summary:
 * - Keeps access defaults and the profile fetch in one lifecycle owner.
 * - Restricts comments until the server's access settings finish loading.
 * - Preserves the original visibility and fetch conditions.
 */
export default function useRusheeZoomAccess({
    loading,
    navigate,
    errorTitle,
    errorDescription,
    api,
    gtid,
    rushee,
    user,
    setRushee,
    setError,
    setLoading,
}) {
    const [isAdmin, setIsAdmin] = useState(false);
    const [isBidcom, setIsBidcom] = useState(false);
    // INVARIANT: comments stay restricted until the access setting loads.
    const [requireCommentToView, setRequireCommentToView] = useState(true);

    const visibilityOptions = { requireCommentToView, isAdmin, isBidcom };
    const showAllComments = shouldShowAllComments(visibilityOptions);
    const visibleComments = rushee
        ? getVisibleComments(rushee.comments, user, visibilityOptions)
        : [];
    const userHasOwnComment = rushee ? hasOwnComment(rushee.comments, user) : false;

    useEffect(() => {
        async function fetch() {
            await loadRusheeZoom({
                verifyUser,
                navigate,
                errorTitle,
                errorDescription,
                auth,
                setIsAdmin,
                setIsBidcom,
                axios,
                api,
                gtid,
                setRushee,
                setRequireCommentToView,
                setError,
                setLoading,
                logError: (message, error) => console.error(message, error),
                logData: (value) => console.log(value),
            });
        }

        if (loading == true) {
            fetch();
        }
    });

    return {
        isAdmin,
        isBidcom,
        requireCommentToView,
        showAllComments,
        visibleComments,
        userHasOwnComment,
    };
}
