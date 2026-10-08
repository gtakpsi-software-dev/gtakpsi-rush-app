import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import { verifyUser } from "../features/auth/verifyUser";
import AddPisQuestionForm from "../features/admin/pis/AddPisQuestionForm";

// Manage the standalone PIS-question form and its verification flow.
export default function AddPis() {
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
        // Verify the session while the page is loading.
        // Verify access and finish the page’s loading state.
        async function fetch() {
            await verifyUser()
                .then(async (response) => {
                    // Navigate to the credential error page if verification fails.
                    if (response == false) {
                        navigate(`/error/${errorTitle}/${errorDescription}`);
                    }
                })
                .catch(() => {
                    // Navigate to the credential error page if verification rejects.
                    navigate(`/error/${errorTitle}/${errorDescription}`);
                });

            setLoading(false);
        }

        if (loading) {
            fetch();
        }
    }, [loading, navigate]);

    // Normalize an optional time, submit an admin request, and store its result.
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
            onSubmit={/* Submit the question with a trimmed category when one is provided. */ () => handleRequest("add_pis_question", {
                question,
                question_type: questionType,
                category: questionCategory.trim() === "" ? undefined : questionCategory.trim(),
            })}
        />
    );
};
