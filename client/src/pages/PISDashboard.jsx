import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import PisDashboardView from "../features/pis/dashboard/PisDashboardView";
import { loadPisDashboardData } from "../features/pis/dashboard/loadPisDashboardData";

import { verifyUser } from "../features/auth/verifyUser";
import { useCommentVisibility } from "../features/comments/useCommentVisibility";

export default function PISDashboard() {
    const user = JSON.parse(localStorage.getItem('user'));
    const { showAll: showRatings } = useCommentVisibility();

    const [rushees, setRushees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const [errorTitle] = useState("");
    const [errorDescription, setErrorDescription] = useState("");

    const navigate = useNavigate();

    const api = import.meta.env.VITE_API_PREFIX;

    useEffect(() => {
        if (loading === true) {
            loadPisDashboardData({
                verifyUser,
                navigate,
                user,
                api,
                post: (...args) => axios.post(...args),
                setRushees,
                setLoading,
                setErrorDescription,
                setError,
                log: (value) => console.log(value),
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- The parsed user is new on each render; including it would repeat the fetch while loading.
    }, [loading, navigate]);

    return <PisDashboardView
        error={error}
        errorTitle={errorTitle}
        errorDescription={errorDescription}
        loading={loading}
        rushees={rushees}
        showRatings={showRatings}
        navigate={navigate}
    />;
}
