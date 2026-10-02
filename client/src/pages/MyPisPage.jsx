import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import MyPisPageView from "../features/brotherPis/MyPisPageView";

import { verifyUser } from "../features/auth/verifyUser";
import { sortPisAppointments } from "../features/brotherPis/appointments";
import { adminPost } from "../features/admin/api";

export default function MyPisPage() {
    const user = JSON.parse(localStorage.getItem("user"));

    const [rushees, setRushees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [errorTitle] = useState("Uh Oh! Something unexpected happened.");
    const [errorDescription, setErrorDescription] = useState("");

    const navigate = useNavigate();
    const api = import.meta.env.VITE_API_PREFIX;

    // The fetch remains mount-only and uses the first render's user and route context.
    const initialFetch = useRef({ user, navigate, api });

    useEffect(() => {
        const { user, navigate, api } = initialFetch.current;

        async function fetchData() {
            setLoading(true);

            try {
                const isAuthenticated = await verifyUser();
                if (!isAuthenticated) {
                    navigate("/");
                    return;
                }

                const payload = {
                    first_name: user.firstname,
                    last_name: user.lastname,
                };

                const response = await adminPost(`${api}/admin/get-brother-pis`, payload);

                if (response.data.status === "success") {
                    const sortedRushees = sortPisAppointments(response.data.payload);
                    setRushees(sortedRushees);
                } else {
                    setErrorDescription("There was an issue fetching your PIS appointments.");
                    setError(true);
                }
            } catch (err) {
                console.error("Error fetching PIS appointments:", err);
                setErrorDescription("There was a network error while fetching your PIS appointments.");
                setError(true);
            }

            setLoading(false);
        }

        fetchData();
    }, []);

    return (
        <MyPisPageView
            rushees={rushees}
            loading={loading}
            error={error}
            errorTitle={errorTitle}
            errorDescription={errorDescription}
            navigate={navigate}
        />
    );
}
