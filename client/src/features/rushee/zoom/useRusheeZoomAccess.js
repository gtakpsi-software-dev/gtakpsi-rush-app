import { useEffect, useState } from "react";
import axios from "axios";

import { auth } from "../../../firebase";
import { getVisibleComments, hasOwnComment, shouldShowAllComments } from "../../comments/commentVisibility";
import { verifyUser } from "../../auth/verifyUser";
import { loadRusheeZoom } from "./loadRusheeZoom";

// Manage profile access checks and derive visible comments from current roles and settings.
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
        // Fetch access and profile data while the page is loading.
        // Load the rushee profile, role claims, and comment-visibility setting.
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
                // Log an access or visibility request error with its context.
                logError: (message, error) => console.error(message, error),
                // Log the loaded rushee profile.
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
