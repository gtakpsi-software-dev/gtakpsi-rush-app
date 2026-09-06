import React, { useState, useEffect } from "react";

import Loader from '../components/Loader'
import SplashPage from "../components/AttendanceComponents/SplashPage";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { verifyGTID } from "../js/verifications";
import { verifyUser } from "../js/verifications";
import axios from "axios";
import DisplayInfo from "../components/AttendanceComponents/DisplayInfo";
import SuccessPage from "../components/AttendanceComponents/SuccessPage";
import { useNavigate } from "react-router-dom";

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

    const handleSubmit = async () => {

        setLoading(true)

        // fetch rushee
        await axios.get(`${api}/rushee/${gtid}`)
            .then((response) => {

                if (response.data.status == "success") {

                    setPage(1)
                    setRushee(response.data.payload)

                    console.log(response.data.payload)

                } else {

                    toast.error(`${response.data.message}`, {
                        position: "top-center",
                        autoClose: 5000,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                        progress: undefined,
                        theme: "dark",
                    });

                }

            })
            .catch((error) => {

                console.log(error)

                toast.error(`Some internal network error occurred`, {
                    position: "top-center",
                    autoClose: 5000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: "dark",
                });

            })

        setLoading(false)

    }

    const goBack = () => {

        setGtid()
        setPage(0)
        setRushee()

    }

    const checkIn = async () => {

        setLoading(true)

        await axios.post(`${api}/rushee/update-attendance/${gtid}`)
        .then((response) => {

            if (response.data.status == "success") {

                setPage(2)

            } else {

                toast.error(`${response.data.message}`, {
                    position: "top-center",
                    autoClose: 5000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: "dark",
                });

            }

        })
        .catch((error) => {

            console.log(error)
            toast.error(`Some internal network error occurred`, {
                position: "top-center",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "dark",
            });

        })

        setLoading(false)

    }

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