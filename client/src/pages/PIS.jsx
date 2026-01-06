import React, { useEffect, useState, useRef, useCallback } from "react";
import Loader from "../components/Loader";
import Navbar from "../components/Navbar";
import VoiceRecorder from "../components/VoiceRecorder";
import CollaborativeTextarea from "../components/CollaborativeTextarea";
import CollaborativeInput from "../components/CollaborativeInput";
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

// Autosave status type
const SAVE_STATUS = {
    IDLE: 'idle',
    SAVING: 'saving',
    SAVED: 'saved',
    ERROR: 'error',
};

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
    const [currentUser, setCurrentUser] = useState(null);
    const [saveStatus, setSaveStatus] = useState(SAVE_STATUS.IDLE);
    const [lastSaved, setLastSaved] = useState(null);

    const navigate = useNavigate();
    const autosaveTimeoutRef = useRef(null);
    const isInitialLoadRef = useRef(true);

    // Initialize WebSocket collaboration
    const collaboration = useCollaboration(`pis-${gtid}`, currentUser);

    // Request latest document state once connected
    useEffect(() => {
        if (collaboration.isConnected) {
            collaboration.requestDocumentState();
        }
    }, [collaboration.isConnected]);

    // Merge incoming document state into local answers and brother fields so that late joiners see the latest
    useEffect(() => {
        const docState = collaboration.documentState;
        if (docState && Object.keys(docState).length > 0) {
            // Handle brother fields
            if (docState['_brotherA_firstName'] !== undefined) {
                setBrotherA(prev => prev.firstName !== docState['_brotherA_firstName'] 
                    ? { ...prev, firstName: docState['_brotherA_firstName'] } : prev);
            }
            if (docState['_brotherA_lastName'] !== undefined) {
                setBrotherA(prev => prev.lastName !== docState['_brotherA_lastName'] 
                    ? { ...prev, lastName: docState['_brotherA_lastName'] } : prev);
            }
            if (docState['_brotherB_firstName'] !== undefined) {
                setBrotherB(prev => prev.firstName !== docState['_brotherB_firstName'] 
                    ? { ...prev, firstName: docState['_brotherB_firstName'] } : prev);
            }
            if (docState['_brotherB_lastName'] !== undefined) {
                setBrotherB(prev => prev.lastName !== docState['_brotherB_lastName'] 
                    ? { ...prev, lastName: docState['_brotherB_lastName'] } : prev);
            }

            // Handle answers (both MC and text questions)
            setAnswers(prev => {
                let changed = false;
                const merged = { ...prev };
                for (const [field, value] of Object.entries(docState)) {
                    // Skip brother fields
                    if (field.startsWith('_brother')) continue;
                    if (merged[field] !== value) {
                        merged[field] = value;
                        changed = true;
                    }
                }
                return changed ? merged : prev;
            });
        }
    }, [collaboration.documentState]);

    // Listen for remote updates and apply them to brother fields and MC questions
    useEffect(() => {
        const updates = collaboration.remoteUpdates;
        if (updates && updates.length > 0) {
            const latestUpdate = updates[updates.length - 1];
            const { field, value } = latestUpdate;
            
            // Handle brother field updates
            if (field === '_brotherA_firstName') {
                setBrotherA(prev => prev.firstName !== value ? { ...prev, firstName: value } : prev);
            } else if (field === '_brotherA_lastName') {
                setBrotherA(prev => prev.lastName !== value ? { ...prev, lastName: value } : prev);
            } else if (field === '_brotherB_firstName') {
                setBrotherB(prev => prev.firstName !== value ? { ...prev, firstName: value } : prev);
            } else if (field === '_brotherB_lastName') {
                setBrotherB(prev => prev.lastName !== value ? { ...prev, lastName: value } : prev);
            } else {
                // Handle answer updates (MC and text questions)
                setAnswers(prev => {
                    if (prev[field] !== value) {
                        return { ...prev, [field]: value };
                    }
                    return prev;
                });
            }
        }
    }, [collaboration.remoteUpdates]);

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
                                const rusheeData = response.data.payload;
                                setRushee(rusheeData);

                                // Prepopulate answers with existing PIS answers
                                const existingAnswers = {};
                                rusheeData.pis?.forEach((pis) => {
                                    existingAnswers[pis.question] = pis.answer;
                                });
                                // Merge with any answers already present (e.g., from real-time doc state)
                                setAnswers((prev) => ({ ...prev, ...existingAnswers }));
                                
                                // Initialize brother names from existing pis_signup data
                                if (rusheeData.pis_signup) {
                                    const signup = rusheeData.pis_signup;
                                    setBrotherA({
                                        firstName: signup.first_brother_first_name !== "none" ? signup.first_brother_first_name : '',
                                        lastName: signup.first_brother_last_name !== "none" ? signup.first_brother_last_name : ''
                                    });
                                    setBrotherB({
                                        firstName: signup.second_brother_first_name !== "none" ? signup.second_brother_first_name : '',
                                        lastName: signup.second_brother_last_name !== "none" ? signup.second_brother_last_name : ''
                                    });
                                }
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

    // Handle answer input changes (for text areas - typing handled inside CollaborativeTextarea)
    const handleAnswerChange = (question, answer, meta = {}) => {
        setAnswers((prev) => ({
            ...prev,
            [question]: answer,
        }));
        
        // Only send websocket update for voice-originated changes; typing is handled inside the textarea component
        if (collaboration.isConnected && meta?.source === 'voice') {
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

    // Handle MC (multiple choice) answer changes - sync immediately
    const handleMCChange = (question, answer) => {
        setAnswers((prev) => ({
            ...prev,
            [question]: answer,
        }));
        
        // Send update via WebSocket for real-time sync
        if (collaboration.isConnected) {
            collaboration.sendTextUpdate(question, answer);
        }
    };

    // Handle brother field changes (WebSocket sync is handled by CollaborativeInput)
    const handleBrotherAChange = (field, value) => {
        setBrotherA(prev => ({ ...prev, [field]: value }));
    };

    const handleBrotherBChange = (field, value) => {
        setBrotherB(prev => ({ ...prev, [field]: value }));
    };

    // Autosave function
    const performAutosave = useCallback(async () => {
        if (!questions.length || !gtid) return;
        
        setSaveStatus(SAVE_STATUS.SAVING);
        
        try {
            // Prepare PIS responses
            const pis_responses = questions.map((question) => ({
                question: question.question,
                answer: answers[question.question] || "",
            }));

            const payload = {
                pis_responses,
                brother_a_first_name: brotherA.firstName,
                brother_a_last_name: brotherA.lastName,
                brother_b_first_name: brotherB.firstName,
                brother_b_last_name: brotherB.lastName,
            };

            await axios.post(`${api}/rushee/autosave-pis/${gtid}`, payload);
            
            setSaveStatus(SAVE_STATUS.SAVED);
            setLastSaved(new Date());
            
            // Reset to idle after 2 seconds
            setTimeout(() => {
                setSaveStatus(SAVE_STATUS.IDLE);
            }, 2000);
        } catch (error) {
            console.error("Autosave error:", error);
            setSaveStatus(SAVE_STATUS.ERROR);
            
            // Reset to idle after 3 seconds
            setTimeout(() => {
                setSaveStatus(SAVE_STATUS.IDLE);
            }, 3000);
        }
    }, [questions, answers, brotherA, brotherB, gtid, api]);

    // Debounced autosave effect - triggers 2 seconds after last change
    useEffect(() => {
        // Skip autosave on initial load
        if (isInitialLoadRef.current) {
            return;
        }

        // Clear existing timeout
        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
        }

        // Set new timeout for autosave (2 seconds after last change)
        autosaveTimeoutRef.current = setTimeout(() => {
            performAutosave();
        }, 2000);

        // Cleanup on unmount
        return () => {
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
            }
        };
    }, [answers, brotherA, brotherB, performAutosave]);

    // Mark initial load as complete after data is loaded
    useEffect(() => {
        if (!loading && questions.length > 0) {
            // Small delay to prevent immediate autosave after load
            const timer = setTimeout(() => {
                isInitialLoadRef.current = false;
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [loading, questions]);

    // Get save status display
    const getSaveStatusDisplay = () => {
        switch (saveStatus) {
            case SAVE_STATUS.SAVING:
                return (
                    <div className="flex items-center space-x-2 text-apple-gray-600">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                        <span className="text-sm">Saving...</span>
                    </div>
                );
            case SAVE_STATUS.SAVED:
                return (
                    <div className="flex items-center space-x-2 text-green-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm">All changes saved</span>
                    </div>
                );
            case SAVE_STATUS.ERROR:
                return (
                    <div className="flex items-center space-x-2 text-red-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-sm">Error saving</span>
                    </div>
                );
            default:
                return lastSaved ? (
                    <div className="flex items-center space-x-2 text-apple-gray-500">
                        <span className="text-sm">Last saved {lastSaved.toLocaleTimeString()}</span>
                    </div>
                ) : null;
        }
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
                                
                                {/* Autosave & Collaboration Status */}
                                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-apple">
                                    <div className="flex items-center justify-between">
                                        <p className="text-apple-footnote text-green-800 font-light">
                                            <span className="font-normal">Autosave Enabled:</span> All changes are automatically saved every few seconds, just like Google Docs. 
                                            Multiple people can collaborate on this form in real-time!
                                        </p>
                                        <div className="ml-4 flex-shrink-0">
                                            {getSaveStatusDisplay()}
                                        </div>
                                    </div>
                                    {!collaboration.isConnected && (
                                        <p className="mt-2 text-orange-600 text-apple-footnote">
                                            ⚠️ Real-time collaboration is currently offline, but autosave is still working.
                                        </p>
                                    )}
                                </div>
                                
                                {/* Typing Restriction Message */}
                                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-apple">
                                    <p className="text-apple-footnote text-blue-800 font-light">
                                        <span className="font-normal">Tip:</span> Only one person should type in each text box at a time to avoid conflicts. 
                                        You can see when others are typing in a field.
                                    </p>
                                </div>
                                
                                {/* Brother Information */}
                                <div className="mb-8 p-6 bg-apple-gray-50 border border-apple-gray-200 rounded-apple">
                                    <h3 className="text-apple-title2 font-normal text-black mb-4">Brother Information</h3>
                                    
                                    {/* Show current assignments if they exist */}
                                    {rushee.pis_signup && (rushee.pis_signup.first_brother_first_name !== "none" || rushee.pis_signup.second_brother_first_name !== "none") && (
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
                                        </div>
                                    )}
                                    
                                    {/* Brother A */}
                                    <div className="mb-6">
                                        <label className="block text-apple-footnote font-normal text-apple-gray-700 mb-2">Brother A:</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <CollaborativeInput
                                                fieldKey="_brotherA_firstName"
                                                placeholder="First Name"
                                                value={brotherA.firstName}
                                                onChange={(value) => handleBrotherAChange('firstName', value)}
                                                className="input-apple text-apple-footnote"
                                                collaboration={collaboration}
                                                currentUser={currentUser}
                                                required
                                            />
                                            <CollaborativeInput
                                                fieldKey="_brotherA_lastName"
                                                placeholder="Last Name"
                                                value={brotherA.lastName}
                                                onChange={(value) => handleBrotherAChange('lastName', value)}
                                                className="input-apple text-apple-footnote"
                                                collaboration={collaboration}
                                                currentUser={currentUser}
                                                required
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Brother B */}
                                    <div className="mb-0">
                                        <label className="block text-apple-footnote font-normal text-apple-gray-700 mb-2">Brother B:</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <CollaborativeInput
                                                fieldKey="_brotherB_firstName"
                                                placeholder="First Name"
                                                value={brotherB.firstName}
                                                onChange={(value) => handleBrotherBChange('firstName', value)}
                                                className="input-apple text-apple-footnote"
                                                collaboration={collaboration}
                                                currentUser={currentUser}
                                            />
                                            <CollaborativeInput
                                                fieldKey="_brotherB_lastName"
                                                placeholder="Last Name"
                                                value={brotherB.lastName}
                                                onChange={(value) => handleBrotherBChange('lastName', value)}
                                                className="input-apple text-apple-footnote"
                                                collaboration={collaboration}
                                                currentUser={currentUser}
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
                                                            onChange={(e) => handleMCChange(question.question, e.target.value)}
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
                                                            onChange={(e) => handleMCChange(question.question, e.target.value)}
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
                                                                handleAnswerChange(question.question, newAnswer, { source: 'voice' });
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

                                {/* Save status footer */}
                                <div className="mt-8 pt-6 border-t border-apple-gray-200 flex items-center justify-between">
                                    <p className="text-apple-footnote text-apple-gray-500">
                                        All changes are automatically saved
                                    </p>
                                    {getSaveStatusDisplay()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
