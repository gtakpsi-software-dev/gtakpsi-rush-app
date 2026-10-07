import { useState } from "react";
import { createAccessSettingsActions } from "./accessSettingsActions";

export default function useAdminAccessSettings({ apiBase, axios, toast, auth }) {
    const [rushAppStatus, setRushAppStatus] = useState({
        disable_bidcom: false,
        disable_regular: false,
        midterm_mode: false,
    });
    const [rushAppLoading, setRushAppLoading] = useState(false);
    const [midtermLoading, setMidtermLoading] = useState(false);
    const [commentVisibilityStatus, setCommentVisibilityStatus] = useState({
        require_comment_to_view: true,
    });
    const [commentVisibilityLoading, setCommentVisibilityLoading] = useState(false);

    const actions = createAccessSettingsActions({
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

    return {
        rushAppStatus,
        setRushAppStatus,
        rushAppLoading,
        midtermLoading,
        commentVisibilityStatus,
        setCommentVisibilityStatus,
        commentVisibilityLoading,
        ...actions,
    };
}
