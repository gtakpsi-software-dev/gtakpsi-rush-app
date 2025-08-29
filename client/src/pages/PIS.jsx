import React, { useEffect, useState } from "react";
import Loader from "../components/Loader";
import Navbar from "../components/Navbar";
import VoiceRecorder from "../components/VoiceRecorder";
import CollaborativeTextarea from "../components/CollaborativeTextarea";
import VoiceTranscriptionHandler from "../components/VoiceTranscriptionHandler";
import axios from "axios";
import CommentWarning from "../components/CommentWarning";
import { validateComment, generateWarnings } from "../js/speculativeWordBank";
import { useCollaboration } from "../hooks/useCollaboration";

import { verifyUser } from "../js/verifications";
import { useNavigate, useParams } from "react-router-dom";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Badges from "../components/Badge";

// Helper to get or create a stable user ID for this browser tab
const getStableUserId = (backendId) => {
    // Prefer the backend ID if provided
    if (backendId) return backendId;
    // Otherwise try to reuse one stored in sessionStorage
    const STORAGE_KEY = "collab_stable_user_id";
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    // Create a new random ID and store it
    const newId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(STORAGE_KEY, newId);
    return newId;
};

export default function PIS() {
    const { gtid } = useParams();

    const [loading, setLoading] = useState(true);
    const [rushee, setRushee] = useState();
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({}); // Stores answers for each question
    const [answerWarnings, setAnswerWarnings] = useState({}); // Stores warnings for each answer
    const [brotherA, setBrotherA] = useState({ firstName: '', lastName: '' });
    const [brotherB, setBrotherB] = useState({ firstName: '', lastName: '' });
    const [brotherC, setBrotherC] = useState({ firstName: '', lastName: '' });
    const [currentUser, setCurrentUser] = useState(null);

    const navigate = useNavigate();

    // Initialize WebSocket collaboration
    const collaboration = useCollaboration(`pis-${gtid}`, currentUser);

    // Request latest document state once connected
    useEffect(() => {
        if (collaboration.isConnected) {
            collaboration.requestDocumentState();
        }
    }, [collaboration.isConnected]);

    // Merge incoming document state into local answers so that late joiners see the latest text
    useEffect(() => {
        const docState = collaboration.documentState;
        if (docState && Object.keys(docState).length > 0) {
            setAnswers(prev => {
                let changed = false;
                const merged = { ...prev };
                for (const [field, value] of Object.entries(docState)) {
                    if (merged[field] !== value) {
                        merged[field] = value;
                        changed = true;
                    }
                }
                return changed ? merged : prev;
            });
        }
    }, [collaboration.documentState]);

    const errorTitle = "Default Error Title";
    const errorDescription = "Default Error Description";
    const api = import.meta.env.VITE_API_PREFIX;

    useEffect(() => {
        async function fetch() {
            await verifyUser()
                .then(async (response) => {
                    if (response === false) {
                        navigate(`/error/${errorTitle}/${errorDescription}`);
                    }

                    // Set current user for collaboration - make it stable across re-renders
                    if (!currentUser || !currentUser.id) {
                        const userId = getStableUserId(response.id);
                        const user = {
                            id: userId,
                            firstName: response.firstName || 'Anonymous',
                            lastName: response.lastName || 'User',
                        };
                        setCurrentUser(user);
                    }

                    // Fetch rushee data
                    await axios.get(`${api}/rushee/${gtid}`)
                        .then((response) => {
                            if (response.data.status === "success") {
                                setRushee(response.data.payload);

                                // Prepopulate answers with existing PIS answers
                                const existingAnswers = {};
                                response.data.payload.pis?.forEach((pis) => {
                                    existingAnswers[pis.question] = pis.answer;
                                });
                                // Merge with any answers already present (e.g., from real-time doc state)
                                setAnswers((prev) => ({ ...prev, ...existingAnswers }));
                            } else {
                                navigate(`/error/${errorTitle}/${"Rushee with this GTID does not exist"}`);
                            }
                        });

                    // Fetch PIS questions
                    await axios.get(`${api}/admin/get_pis_questions`)
                        .then((response) => {
                            if (response.data.status === "success") {
                                setQuestions(response.data.payload);
                            } else {
                                navigate(`/error/${errorTitle}/${"Failed to fetch PIS questions"}`);
                            }
                        });
                })
                .catch((error) => {
                    console.log(error);
                    navigate(`/error/${errorTitle}/${errorDescription}`);
                });

            setLoading(false);
        }

        if (loading) {
            fetch();
        }
    }, [loading, api, gtid, navigate]);

    // Handle answer input changes
    const handleAnswerChange = (question, answer, meta = {}) => {
        setAnswers((prev) => ({
            ...prev,
            [question]: answer,
        }));
        
        // Only send websocket update if this change originated from typing in the textarea
        if (collaboration.isConnected && meta?.source === 'typing') {
            collaboration.sendTextUpdate(question, answer);
        }
        
        // Validate answer for speculative language and rushee names
        if (rushee && answer) {
            const validationResult = validateComment(answer, rushee.first_name, rushee.last_name);
            const warnings = generateWarnings(validationResult);
            
            setAnswerWarnings((prev) => ({
                ...prev,
                [question]: warnings
            }));
        } else {
            // Clear warnings if no answer
            setAnswerWarnings((prev) => {
                const newWarnings = { ...prev };
                delete newWarnings[question];
                return newWarnings;
            });
        }
    };

    // Handle form submission
    const handleSubmit = async () => {
        // Validation: At least Brother A must be filled out
        if (!brotherA.firstName.trim() || !brotherA.lastName.trim()) {
            toast.error("Brother A information is required", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
            return;
        }

        // Check for speculative language warnings
        const hasWarnings = Object.values(answerWarnings).some(warnings => warnings && warnings.length > 0);
        if (hasWarnings) {
            toast.warning("Some answers contain potentially problematic language. Please review before submitting.", {
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

        setLoading(true);

        try {
            // Register Brother A
            await axios.post(`${api}/admin/pis-signup/${gtid}`, {
                brother_first_name: brotherA.firstName.trim(),
                brother_last_name: brotherA.lastName.trim()
            });

            // Register Brother B if provided
            if (brotherB.firstName.trim() && brotherB.lastName.trim()) {
                await axios.post(`${api}/admin/pis-signup/${gtid}`, {
                    brother_first_name: brotherB.firstName.trim(),
                    brother_last_name: brotherB.lastName.trim()
                });
            }

            // Register Brother C if provided
            if (brotherC.firstName.trim() && brotherC.lastName.trim()) {
                await axios.post(`${api}/admin/pis-signup/${gtid}`, {
                    brother_first_name: brotherC.firstName.trim(),
                    brother_last_name: brotherC.lastName.trim()
                });
            }

            // Prepare the payload with all questions, including unanswered ones
            const payload = questions.map((question) => ({
                question: question.question,
                answer: answers[question.question] || "", // Use an empty string for unanswered questions
            }));

            // Submit PIS responses
            const response = await axios.post(`${api}/rushee/post-pis/${gtid}`, payload);
            
            if (response.data.status === "success") {
                navigate(`/brother/rushee/${gtid}`);
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
        } catch (error) {
            console.error("Error submitting PIS:", error);
            toast.error("An error occurred while submitting the PIS. Please try again.", {
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

        setLoading(false);
    };

    return (
        <div>
            {loading ? (
                <Loader />
            ) : (
                <div className="min-h-screen w-full bg-white overflow-y-auto">
                    <Navbar />

                    <div className="pt-24 p-4 pb-20">
                        <div className="container mx-auto px-4 max-w-4xl">
                            {/* Collaboration Status */}
                            {collaboration.isConnected && (
                                 <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-apple">
                                     <div className="flex items-center space-x-2">
                                         <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                         <span className="text-sm text-green-800">
                                             {collaboration.connectedUsers.length} other user{collaboration.connectedUsers.length===1?'':'s'} online
                                         </span>
                                     </div>
                                 </div>
                             )}

                            {/* Profile Header */}
                            <div className="card-apple p-6 mb-6">
                                <div className="flex flex-col md:flex-row items-start gap-6">
                                    <img
                                        src={rushee.image_url}
                                        alt={`${rushee.first_name} ${rushee.last_name}`}
                                        className="w-60 h-60 rounded-apple-2xl object-cover border border-apple-gray-200 shrink-0"
                                    />
                                    <div className="flex-1">
                                        <div className="flex flex-col sm:flex-row gap-3 items-start mb-4">
                                            <h1 className="text-apple-large font-light text-black">
                                                {rushee.first_name} {rushee.last_name}
                                            </h1>
                                            <div className="flex flex-wrap gap-2">
                                                {rushee.attendance.map((event, idx) => (
                                                    <Badges text={event.name} key={idx} />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-2 text-apple-body">
                                            <p className="text-apple-gray-600 font-light">
                                                <span className="text-black font-normal">Pronouns:</span> {rushee.pronouns}
                                            </p>
                                            <p className="text-apple-gray-600 font-light">
                                                <span className="text-black font-normal">Major:</span> {rushee.major}
                                            </p>
                                            <p className="text-apple-gray-600 font-light">
                                                <span className="text-black font-normal">Email:</span> {rushee.email}
                                            </p>
                                            <p className="text-apple-gray-600 font-light">
                                                <span className="text-black font-normal">Phone:</span> {rushee.phone_number}
                                            </p>
                                            <p className="text-apple-gray-600 font-light">
                                                <span className="text-black font-normal">Housing:</span> {rushee.housing}
                                            </p>
                                            <p className="text-apple-gray-600 font-light">
                                                <span className="text-black font-normal">GTID:</span> {rushee.gtid}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* PIS Questions */}
                            <div className="card-apple p-6 mb-6">
                                <h1 className="text-apple-title1 font-light text-black mb-6">PIS Questions</h1>
                                
                                {/* Disclaimer Message */}
                                <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-apple">
                                    <p className="text-apple-footnote text-orange-800 font-light">
                                        <span className="font-normal">Note:</span> Multiple people can now collaborate on this form in real-time! 
                                        You'll see others' cursors and typing as they work. Only the main interviewer should submit when everyone is ready.
                                        {!collaboration.isConnected && (
                                            <span className="block mt-2 text-orange-600">
                                                ⚠️ Real-time collaboration is currently offline. 
                                            </span>
                                        )}
                                    </p>
                                </div>
                                
                                {/* Typing Restriction Message */}
                                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-apple">
                                    <p className="text-apple-footnote text-blue-800 font-light">
                                        <span className="font-normal">Important:</span> Only one person should type in each text box at a time to avoid conflicts. 
                                        You can see when others are typing in a field - please wait for them to finish before adding your input.
                                    </p>
                                </div>
                                
                                {/* Brother Information */}
                                <div className="mb-8 p-6 bg-apple-gray-50 border border-apple-gray-200 rounded-apple">
                                    <h3 className="text-apple-title2 font-normal text-black mb-4">Brother Information</h3>
                                    
                                    {/* Show current assignments if they exist */}
                                    {rushee.pis_signup && (rushee.pis_signup.first_brother_first_name !== "none" || rushee.pis_signup.second_brother_first_name !== "none" || rushee.pis_signup.third_brother_first_name !== "none") && (
                                        <div className="mb-6 p-4 bg-apple-gray-100 border border-apple-gray-200 rounded-apple">
                                            <h4 className="text-apple-body text-black font-normal mb-2">Currently Assigned:</h4>
                                            {rushee.pis_signup.first_brother_first_name !== "none" && (
                                                <p className="text-apple-body text-apple-gray-600 font-light">
                                                    Brother 1: {rushee.pis_signup.first_brother_first_name} {rushee.pis_signup.first_brother_last_name}
                                                </p>
                                            )}
                                            {rushee.pis_signup.second_brother_first_name !== "none" && (
                                                <p className="text-apple-body text-apple-gray-600 font-light">
                                                    Brother 2: {rushee.pis_signup.second_brother_first_name} {rushee.pis_signup.second_brother_last_name}
                                                </p>
                                            )}
                                            {rushee.pis_signup.third_brother_first_name !== "none" && (
                                                <p className="text-apple-body text-apple-gray-600 font-light">
                                                    Brother 3: {rushee.pis_signup.third_brother_first_name} {rushee.pis_signup.third_brother_last_name}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    
                                    {/* Brother A */}
                                    <div className="mb-6">
                                        <label className="block text-apple-footnote font-normal text-apple-gray-700 mb-2">Brother A (Required):</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <input
                                                type="text"
                                                placeholder="First Name"
                                                value={brotherA.firstName}
                                                onChange={(e) => setBrotherA({...brotherA, firstName: e.target.value})}
                                                className="input-apple text-apple-footnote"
                                                required
                                            />
                                            <input
                                                type="text"
                                                placeholder="Last Name"
                                                value={brotherA.lastName}
                                                onChange={(e) => setBrotherA({...brotherA, lastName: e.target.value})}
                                                className="input-apple text-apple-footnote"
                                                required
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Brother B */}
                                    <div className="mb-6">
                                        <label className="block text-apple-footnote font-normal text-apple-gray-700 mb-2">Brother B (Optional):</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <input
                                                type="text"
                                                placeholder="First Name"
                                                value={brotherB.firstName}
                                                onChange={(e) => setBrotherB({...brotherB, firstName: e.target.value})}
                                                className="input-apple text-apple-footnote"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Last Name"
                                                value={brotherB.lastName}
                                                onChange={(e) => setBrotherB({...brotherB, lastName: e.target.value})}
                                                className="input-apple text-apple-footnote"
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Brother C */}
                                    <div className="mb-0">
                                        <label className="block text-apple-footnote font-normal text-apple-gray-700 mb-2">Brother C (Optional):</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <input
                                                type="text"
                                                placeholder="First Name"
                                                value={brotherC.firstName}
                                                onChange={(e) => setBrotherC({...brotherC, firstName: e.target.value})}
                                                className="input-apple text-apple-footnote"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Last Name"
                                                value={brotherC.lastName}
                                                onChange={(e) => setBrotherC({...brotherC, lastName: e.target.value})}
                                                className="input-apple text-apple-footnote"
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                {questions.length > 0 ? (
                                    questions.map((question, idx) => (
                                        <div key={idx} className="mb-8">
                                            <p className="text-apple-body text-black font-normal mb-4">
                                                {idx + 1}. {question.question}
                                            </p>

                                            {question.question_type === "MC" ? (
                                                <div className="flex items-center space-x-6">
                                                    <label className="flex items-center text-apple-body text-black font-light">
                                                        <input
                                                            type="radio"
                                                            name={question.question}
                                                            value="Yes"
                                                            checked={answers[question.question] === "Yes"}
                                                            onChange={(e) => handleAnswerChange(question.question, e.target.value)}
                                                            className="mr-3 w-4 h-4 text-black focus:ring-black focus:ring-2"
                                                        />
                                                        Yes
                                                    </label>
                                                    <label className="flex items-center text-apple-body text-black font-light">
                                                        <input
                                                            type="radio"
                                                            name={question.question}
                                                            value="No"
                                                            checked={answers[question.question] === "No"}
                                                            onChange={(e) => handleAnswerChange(question.question, e.target.value)}
                                                            className="mr-3 w-4 h-4 text-black focus:ring-black focus:ring-2"
                                                        />
                                                        No
                                                    </label>
                                                </div>
                                            ) : (
                                                <div className="flex gap-3 items-start">
                                                    <div className="flex-1">
                                                        <CollaborativeTextarea
                                                            questionKey={question.question}
                                                            value={answers[question.question] || ""}
                                                            onChange={handleAnswerChange}
                                                            placeholder="Your answer..."
                                                            className="input-apple w-full min-h-[120px] resize-y text-apple-footnote"
                                                            collaboration={collaboration}
                                                            currentUser={currentUser}
                                                        />
                                                    </div>
                                                    <div className="flex-shrink-0 self-center">
                                                        <VoiceTranscriptionHandler
                                                            questionKey={question.question}
                                                            currentValue={answers[question.question] || ""}
                                                            onTranscription={(newAnswer) => {
                                                                handleAnswerChange(question.question, newAnswer);
                                                            }}
                                                            disabled={!collaboration.isConnected && collaboration.connectedUsers.length > 0}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Show warnings for this answer */}
                                            {answerWarnings[question.question] && answerWarnings[question.question].length > 0 && (
                                                <div className="mt-4">
                                                    <CommentWarning 
                                                        warnings={answerWarnings[question.question]} 
                                                        onDismiss={(index) => {
                                                            const newWarnings = answerWarnings[question.question].filter((_, i) => i !== index);
                                                            setAnswerWarnings((prev) => ({
                                                                ...prev,
                                                                [question.question]: newWarnings
                                                            }));
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-apple-body text-apple-gray-600 font-light text-center py-8">No questions available.</p>
                                )}

                                <button
                                    onClick={handleSubmit}
                                    disabled={!brotherA.firstName.trim() || !brotherA.lastName.trim()}
                                    className={`w-full py-4 px-6 text-apple-headline font-light rounded-apple-xl transition-all duration-200 ${
                                        brotherA.firstName.trim() && brotherA.lastName.trim()
                                            ? 'bg-black text-white hover:bg-apple-gray-800 cursor-pointer'
                                            : 'bg-apple-gray-200 text-apple-gray-400 cursor-not-allowed'
                                    }`}
                                >
                                    Submit Answers
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
