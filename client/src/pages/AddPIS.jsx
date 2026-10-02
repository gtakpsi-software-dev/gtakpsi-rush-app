import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import { verifyUser } from "../features/auth/verifyUser";
import AddPisQuestionForm from "../features/admin/pis/AddPisQuestionForm";

export default function AddPIS() {
    const apiBase = import.meta.env.VITE_API_PREFIX + "/admin";

    const [question, setQuestion] = useState("");
    const [questionType, setQuestionType] = useState("");
    const [questionCategory, setQuestionCategory] = useState("");
    const [, setResults] = useState("");
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
        <AddPisQuestionForm
            question={question}
            setQuestion={setQuestion}
            questionType={questionType}
            setQuestionType={setQuestionType}
            questionCategory={questionCategory}
            setQuestionCategory={setQuestionCategory}
            onSubmit={() => handleRequest("add_pis_question", {
                question,
                question_type: questionType,
                category: questionCategory.trim() === "" ? undefined : questionCategory.trim(),
            })}
        />
    );
};
