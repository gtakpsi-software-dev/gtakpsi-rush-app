import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import Loader from "../components/Loader";
import Navbar from "../components/Navbar"
import MyError from "../components/Error";
import Badges from "../components/Badge";

import { verifyUser } from "../js/verifications";

export default function PISDashboard() {

    const user = JSON.parse(localStorage.getItem('user'))

    const [rushees, setRushees] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    const [errorTitle, setErrorTitle] = useState("")
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

    return (
        <div>
            {error ? (
                <div>

                    {errorTitle} {errorDescription}

                </div>
            ) : (
                <div>
                    {loading ? (
                        <Loader />
                    ) : (
                        <div className="h-screen w-screen bg-slate-800 overflow-y-scroll">
                            <Navbar />

                            <div className="pt-20 p-4">

                                <h1 className="mt-2 text-center font-bold bg-gradient-to-r from-sky-700 via-amber-600 to-sky-700 animate-text bg-clip-text text-transparent text-4xl">
                                    Your PIS Interviews:
                                </h1>

                                <h1 className="m-2 text-slate-500 text-center">Here are the PIS Interviews you have signed up for</h1>

                                <div className="container mx-auto px-4">
                                    <div className="grid gap-6 mt-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                                        {rushees.map((rushee) => (
                                            <div
                                                onClick={() => {
                                                    navigate(`/brother/rushee/${rushee.gtid}`);
                                                }}
                                                key={rushee.id}
                                                className="flex cursor-pointer flex-col bg-slate-700 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden border-2 border-transparent hover:border-blue-500"
                                            >
                                                {/* Picture */}
                                                <img
                                                    className="w-full h-48 object-cover"
                                                    src={rushee.image_url}
                                                    alt={rushee.name}
                                                />

                                                {/* Content */}
                                                <div className="flex flex-col flex-grow p-4">
                                                    <div className="flex flex-row gap-4">

                                                        <h2 className="text-xl font-bold text-white mb-2 truncate">
                                                            {rushee.name}
                                                        </h2>
                                                        {rushee.attendance.map((event, idx) => (
                                                            <Badges text={event.name} key={idx} />
                                                        ))}

                                                    </div>
                                                    <p className="text-sm text-gray-400 mb-1 truncate">
                                                        {rushee.email}
                                                    </p>
                                                    <p className="text-sm text-gray-400 mb-1 truncate">
                                                        {rushee.major}
                                                    </p>
                                                    <p className="text-sm text-gray-400">GTID: {rushee.gtid}</p>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {rushee.ratings.map((rating, rIdx) => (
                                                            <span
                                                                key={rIdx}
                                                                className="bg-slate-500 text-gray-200 px-2 py-1 rounded text-sm"
                                                            >
                                                                {rating.name}: {rating.value}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )

}