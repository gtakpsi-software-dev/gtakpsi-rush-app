import { useState, useEffect } from "react";

import AttendanceView from "../features/attendance/AttendanceView";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { verifyUser } from "../features/auth/verifyUser";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { createAttendanceActions } from "../features/attendance/createAttendanceActions";

export default function Attendance() {
    const [gtid, setGtid] = useState();
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState();
    const [rushee, setRushee] = useState();

    const api = import.meta.env.VITE_API_PREFIX;
    const navigate = useNavigate();

    useEffect(() => {
        async function fetch() {
            setLoading(true);
            await verifyUser()
                .then(async (response) => {
                    if (response === false) {
                        navigate("/");
                    }

                    await axios
                        .get(`${api}/rushee/get-rushees`)
                        .then((response) => {
                            if (response.data.status === "success") {
                                setRushees(response.data.payload);
                                setFilteredRushees(response.data.payload);

                                console.log(response.data.payload);
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
                .catch(() => {
                    setErrorDescription("There was an error verifying your credentials.");
                    setError(true);
                });

            setLoading(false);
        }

        if (loading === true) {
            fetch();
        }
    }, [loading, navigate]);

    const { handleSubmit, goBack, checkIn } = createAttendanceActions({
        api, gtid, setLoading, setPage, setRushee, setGtid,
        axios, toast, log: (value) => console.log(value),
    });

    return (
        <AttendanceView
            loading={loading}
            page={page}
            gtid={gtid}
            setGtid={setGtid}
            rushee={rushee}
            handleSubmit={handleSubmit}
            goBack={goBack}
            checkIn={checkIn}
        />
    );
}
