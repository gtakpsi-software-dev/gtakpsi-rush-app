import React, { useState, useEffect } from "react";
import axios from 'axios'

import { verifyUser } from "../js/verifications";
import { useNavigate } from "react-router-dom";
import Loader from "../components/Loader";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Navbar from "../components/Navbar";

export default function BrotherPIS() {

    const api = import.meta.env.VITE_API_PREFIX;
    const user = JSON.parse(localStorage.getItem('user'))

    const [days, setDays] = useState(new Map());
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [loading, setLoading] = useState(true)

    const navigate = useNavigate()

    useEffect(() => {
        async function fetch() {
            setLoading(true);
            await verifyUser()
                .then(async (response) => {
                    if (response === false) {
                        navigate("/");
                    }

                    await axios.get(`${api}/rushee/get-timeslots`).then((response) => {
                        if (response.data.status && response.data.status == "success") {

                            const tempDays = new Map();

                            console.log(response.data.payload)

                            for (const slot in response.data.payload) {
                                const jsDate = new Date(
                                    parseInt(response.data.payload[slot].time.$date.$numberLong)
                                );

                                const day = jsDate.toDateString(); // Grouping by the full date

                                const newSlot = {
                                    time: jsDate,
                                    rushee_first_name: response.data.payload[slot].rushee_first_name,
                                    rushee_last_name: response.data.payload[slot].rushee_last_name,
                                    rushee_gtid: response.data.payload[slot].rushee_gtid,
                                    first_brother_first_name: response.data.payload[slot].first_brother_first_name,
                                    first_brother_last_name: response.data.payload[slot].first_brother_last_name,
                                    second_brother_first_name: response.data.payload[slot].second_brother_first_name,
                                    second_brother_last_name: response.data.payload[slot].second_brother_last_name,
                                };
                            
                                if (tempDays.has(day)) {
                                    tempDays.get(day).push(newSlot);
                                    tempDays.set(
                                        day,
                                        tempDays.get(day).sort((a, b) => a.time - b.time)
                                    );
                                } else {
                                    tempDays.set(day, [newSlot]);
                                }

                                setDays(tempDays);
                            }
                        } else {
                            const title = "Uh Oh! Something weird happened..."
                const description = "Some network error happened while submitting your comment..."

                navigate(`/error/${title}/${description}`)
                        }
                    });
                })
                .catch(() => {
                    const title = "Uh Oh! Something weird happened..."
                const description = "Some network error happened while submitting your comment..."

                navigate(`/error/${title}/${description}`)
                });

            // before we exit, sort the individual arrays by time
            // for (const d of days.keys()) {

            //     days.set(d, days.get(d).sort((a, b) => b.time - a.time))
            //     console.log(days.get(d))
                
            // }

            setLoading(false);
        }

        if (loading === true) {
            fetch();
        }
    }, [loading, navigate]);

    const handleSlotSelection = (day, slot) => {
        const slotKey = `${day}zz${slot.time.toISOString()}zz${slot.rushee_gtid}`;
        setSelectedSlot(selectedSlot === slotKey ? null : slotKey);
    };

    const handleSubmit = async () => {
        if (!selectedSlot) return;

        try {
            const [day, time, gtid] = selectedSlot.split("zz");

            const payload = {
                brother_first_name: user.firstname,
                brother_last_name: user.lastname, 
            };

            const response = await axios.post(
                `${api}/admin/pis-signup/${gtid}`,
                payload
            );

            if (response.data.status === "success") {
                alert("YOU successfully signed up for PIS timeslot! Great Work!");
                window.location.reload();
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
                    style: {
                        fontSize: '18px',
                        padding: '20px',
                        minHeight: '80px'
                    }
                });
            }
        } catch (error) {
            console.error("Error submitting selected slot:", error);
            toast.error("An error occurred while submitting the timeslot. Please try again.", {
                position: "top-center",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "dark",
                style: {
                    fontSize: '18px',
                    padding: '20px',
                    minHeight: '80px'
                }
            });
        }
    };

    return (

        <div>
            <Navbar />
            {loading ? <Loader /> : <div className="w-screen min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center">

                <div className="h-14" />

                <div className="text-center w-full p-8">
                    <h1 className="mb-2 font-bold bg-gradient-to-r from-sky-700 via-amber-600 to-sky-700 animate-text bg-clip-text text-transparent text-4xl">
                        Choose Your PIS Timeslot
                    </h1>
                    <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                        {Array.from(days.entries()).map(([day, timeslots]) => (
                            <div
                                key={day}
                                className="bg-gray-800 shadow-lg rounded-lg p-4"
                            >
                                <h2 className="text-xl font-semibold text-center mb-4">
                                    {day}
                                </h2>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {timeslots.map((slot, index) => {
                                        const rusheeName = `${slot.rushee_first_name} ${slot.rushee_last_name}`;
                                        const slotKey = `${day}zz${slot.time.toISOString()}zz${slot.rushee_gtid}`;
                                        const isSelected = selectedSlot === slotKey;

                                        return (
                                            <div
                                                key={index}
                                                className={`py-2 px-4 rounded-lg transition transform cursor-pointer ${
                                                    isSelected
                                                        ? "bg-gradient-to-r from-teal-500 to-green-600 scale-105 shadow-lg"
                                                        : "bg-gradient-to-r from-sky-700 via-teal-600 to-amber-600 hover:scale-105 hover:shadow-lg"
                                                }`}
                                                onClick={() => handleSlotSelection(day, slot)}
                                            >
                                                <p>
                                                    <strong>Time:</strong>{" "}
                                                    {slot.time.toLocaleTimeString([], {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </p>
                                                <p>
                                                    <strong>Rushee:</strong>{" "}
                                                    {slot.rushee_first_name}{" "}
                                                    {slot.rushee_last_name}
                                                </p>
                                                <p>
                                                    <strong>First Brother:</strong>{" "}
                                                    {slot.first_brother_first_name || "None"}{" "}
                                                    {slot.first_brother_last_name || "None"}
                                                </p>
                                                <p>
                                                    <strong>Second Brother:</strong>{" "}
                                                    {slot.second_brother_first_name || "None"}{" "}
                                                    {slot.second_brother_last_name || "None"}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                    <button
                            onClick={handleSubmit}
                            className={`${selectedSlot ? "visible" : "invisible"} mt-6 py-3 px-6 text-lg font-bold rounded-lg transition bg-gradient-to-r from-amber-600 to-sky-700 hover:scale-105 hover:shadow-lg text-white`}
                        >
                            Submit Selected Slot
                        </button>
                </div>
            </div>}
        </div>

    );

}