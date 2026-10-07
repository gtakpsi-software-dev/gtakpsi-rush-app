import { useEffect, useState } from "react";
import axios from "axios";
import { auth } from "../../firebase";
import { shouldShowAllComments } from "./commentVisibility.js";

/**
 * Fetches the comment-visibility setting + the current user's admin/bidcom
 * claims, and returns whether all comments (and therefore ratings) should be
 * shown. Mirrors the inline logic in RusheeComments so every surface stays in
 * sync with one switch.
 */
export function useCommentVisibility() {
    const [requireCommentToView, setRequireCommentToView] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isBidcom, setIsBidcom] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            const api = import.meta.env.VITE_API_PREFIX;
            try {
                const res = await axios.get(`${api}/brother/comment-visibility/status`);
                if (!cancelled && res.data.status === "success") {
                    setRequireCommentToView(res.data.require_comment_to_view);
                }
            } catch {
                // default: restricted
            }

            const currentUser = auth.currentUser;
            if (currentUser) {
                try {
                    const tokenResult = await currentUser.getIdTokenResult(true);
                    if (!cancelled) {
                        setIsAdmin(tokenResult.claims?.admin === true);
                        setIsBidcom(tokenResult.claims?.bidcom === true);
                    }
                } catch {
                    // ignore
                }
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const visibilityOptions = { requireCommentToView, isAdmin, isBidcom };
    return { visibilityOptions, showAll: shouldShowAllComments(visibilityOptions) };
}
