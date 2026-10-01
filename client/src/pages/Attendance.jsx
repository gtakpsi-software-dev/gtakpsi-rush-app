import { useState, useEffect } from "react";

import Loader from '../components/Loader'
import SplashPage from "../components/AttendanceComponents/SplashPage";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { verifyUser } from "../features/auth/verifyUser";
import axios from "axios";
import DisplayInfo from "../components/AttendanceComponents/DisplayInfo";
import SuccessPage from "../components/AttendanceComponents/SuccessPage";
import { useNavigate } from "react-router-dom";
import { createAttendanceActions } from "../features/attendance/createAttendanceActions";

export default function Attendance() {

    const [gtid, setGtid] = useState()
    const [page, setPage] = useState(0)
    const [loading, setLoading] = useState()
    const [rushee, setRushee] = useState()

    const api = import.meta.env.VITE_API_PREFIX;

    const navigate = useNavigate()

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

        <div>

            {loading ? <Loader /> : <div>

                {page == 0 ? <SplashPage
                    func={handleSubmit}
                    gtid={gtid}
                    setGtid={setGtid}
                /> : <div>

                    {page == 1 ? <DisplayInfo
                        rushee={rushee}
                        goBack={goBack}
                        checkIn={checkIn}
                    /> : <SuccessPage goBack={goBack} />}

                </div>}

            </div>}

        </div>

    )

}
