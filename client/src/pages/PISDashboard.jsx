import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import PisDashboardView from "../features/pis/dashboard/PisDashboardView";

import { verifyUser } from "../features/auth/verifyUser";
import { useCommentVisibility } from "../hooks/useCommentVisibility";

export default function PISDashboard() {

    const user = JSON.parse(localStorage.getItem('user'))
    const { showAll: showRatings } = useCommentVisibility()

    const [rushees, setRushees] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    const [errorTitle] = useState("")
    const [errorDescription, setErrorDescription] = useState("")

    const navigate = useNavigate()

    const api = import.meta.env.VITE_API_PREFIX;

    useEffect(() => {
        async function fetch() {
            setLoading(true);
            await verifyUser()
                .then(async (response) => {
                    if (response === false) {
                        navigate("/");
                    }

                    const payload = {
                        "first_name": user.firstname,
                        "last_name": user.lastname,
                    }

                    await axios
                        .post(`${api}/admin/get-brother-pis`, payload)
                        .then((response) => {
                            if (response.data.status === "success") {

                                setRushees(response.data.payload);
                                console.log(response.data.payload)

                            } else {
                                setErrorDescription("There was some issue fetching the rushees");
                                setError(true);
                            }
                        })
                        .catch(() => {
                            setErrorDescription("There was some network error while fetching the rushees.");
                            setError(true);
                        });
                })
                .catch((error) => {

                    console.log(error)

                    setErrorDescription("There was an error verifying your credentials.");
                    setError(true);
                });

            setLoading(false);
        }

        if (loading === true) {
            fetch();
        }
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
