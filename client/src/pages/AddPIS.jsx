import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import { verifyUser } from "../js/verifications";

export default function AddPIS() {
    const apiBase = import.meta.env.VITE_API_PREFIX + "/admin";

    const [question, setQuestion] = useState("");
    const [questionType, setQuestionType] = useState("");
    const [questionCategory, setQuestionCategory] = useState("");
    const [timeslotTime, setTimeslotTime] = useState("");
    const [timeslotChange, setTimeslotChange] = useState(1);
    const [rushNightName, setRushNightName] = useState("");
    const [rushNightTime, setRushNightTime] = useState("");
    const [results, setResults] = useState("");
    const [loading, setLoading] = useState(true);

    const navigate = useNavigate();

    const errorTitle = "Invalid User Credentials";
    const errorDescription = "If this is a mistake, try logging back in";

    useEffect(() => {
        async function fetch() {
            await verifyUser()
                .then(async (response) => {
                    if (response == false) {
                        navigate(`/error/${errorTitle}/${errorDescription}`);
                    }
                })
                .catch(() => {
                    navigate(`/error/${errorTitle}/${errorDescription}`);
                });

            setLoading(false);
        }

        if (loading) {
            fetch();
        }
    }, [loading, navigate]);

    const handleRequest = async (endpoint, payload, method = "post") => {
        try {
            const updatedPayload = { ...payload };

            if (updatedPayload.time) {
                updatedPayload.time = new Date(updatedPayload.time).toISOString();
            }

            const response = await axios[method](`${apiBase}/${endpoint}`, updatedPayload);
            setResults(JSON.stringify(response.data, null, 2));
        } catch (error) {
            setResults(error.response?.data || "An error occurred");
        }
    };

    return (
        <div className="container mx-auto p-6 bg-gray-100 min-h-screen">

            {/* Add PIS Question */}
            <div className="bg-white p-6 rounded-lg shadow-md max-w-lg mx-auto">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Add PIS Question</h2>
                <input
                    type="text"
                    placeholder="Enter Question"
                    className="border border-gray-300 rounded-md p-3 w-full mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Enter Question Type"
                    className="border border-gray-300 rounded-md p-3 w-full mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Category (blank = always shown to every rushee)"
                    className="border border-gray-300 rounded-md p-3 w-full mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={questionCategory}
                    onChange={(e) => setQuestionCategory(e.target.value)}
                />
                <button
                    onClick={() => handleRequest("add_pis_question", { question, question_type: questionType, category: questionCategory.trim() === "" ? undefined : questionCategory.trim() })}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-5 rounded-lg w-full transition duration-200"
                >
                    Add Question
                </button>
            </div>
        </div>
    );
};
