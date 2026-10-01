import React, { useEffect, useState, useRef, useCallback } from "react";
import Loader from "../components/Loader";
import Navbar from "../components/Navbar";
import axios from "axios";
import { useCollaboration } from "../hooks/useCollaboration";

import { verifyUser } from "../js/verifications";
import { useNavigate, useParams } from "react-router-dom";
import { auth } from "../firebase";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import PisProfileHeader from "../features/pis/PisProfileHeader";
import PisBrotherFields from "../features/pis/PisBrotherFields";
import PisQuestionResponses from "../features/pis/PisQuestionResponses";
import PisSaveStatus from "../features/pis/PisSaveStatus";
import PisQuestionsPending from "../features/pis/PisQuestionsPending";
import { SAVE_STATUS } from "../features/pis/saveStatus";
import { getStableUserId } from "../features/pis/stableUserId";
import { parseServerDate } from "../features/pis/parseServerDate";
import { applyDocumentState, applyRemoteUpdates } from "../features/pis/collaborationState";
import { performPisAutosave } from "../features/pis/performPisAutosave";

export default function PIS() {
    const { gtid } = useParams();

    const [loading, setLoading] = useState(true);
    const [rushee, setRushee] = useState();
    const [questions, setQuestions] = useState([]);
    const [questionsAvailable, setQuestionsAvailable] = useState(true);
    const [revealAt, setRevealAt] = useState(null);
    const [answers, setAnswers] = useState({}); // Stores answers for each question
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

    useEffect(() => {
        applyDocumentState(collaboration.documentState, { setBrotherA, setBrotherB, setAnswers });
    }, [collaboration.documentState]);

    useEffect(() => {
        applyRemoteUpdates(collaboration.remoteUpdates, { setBrotherA, setBrotherB, setAnswers });
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

                    // Set current user for collaboration - get name from Firebase auth or localStorage
                    if (!currentUser || !currentUser.id) {
                        const firebaseUser = auth.currentUser;
                        const storedUser = localStorage.getItem('user');
                        const parsedStoredUser = storedUser ? JSON.parse(storedUser) : null;
                        
                        // Get user ID
                        const userId = getStableUserId(firebaseUser?.uid || parsedStoredUser?._id);
                        
                        // Get name from Firebase displayName or localStorage
                        let firstName = 'Anonymous';
                        let lastName = 'User';
                        
                        if (firebaseUser?.displayName) {
                            const nameParts = firebaseUser.displayName.split(' ');
                            firstName = nameParts[0] || 'Anonymous';
                            lastName = nameParts.slice(1).join(' ') || '';
                        } else if (parsedStoredUser?.firstName || parsedStoredUser?.firstname) {
                            firstName = parsedStoredUser.firstName || parsedStoredUser.firstname || 'Anonymous';
                            lastName = parsedStoredUser.lastName || parsedStoredUser.lastname || '';
                        } else if (firebaseUser?.email) {
                            // Fallback to email prefix
                            firstName = firebaseUser.email.split('@')[0] || 'Anonymous';
                            lastName = '';
                        }
                        
                        const user = {
                            id: userId,
                            firstName,
                            lastName,
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
                                    
                                    // Helper to check if a value is a valid name (not "none", null, undefined, or empty)
                                    const isValidName = (val) => val && val.trim() && val.trim().toLowerCase() !== "none";
                                    
                                    const brotherAFirst = isValidName(signup.first_brother_first_name) ? signup.first_brother_first_name.trim() : '';
                                    const brotherALast = isValidName(signup.first_brother_last_name) ? signup.first_brother_last_name.trim() : '';
                                    const brotherBFirst = isValidName(signup.second_brother_first_name) ? signup.second_brother_first_name.trim() : '';
                                    const brotherBLast = isValidName(signup.second_brother_last_name) ? signup.second_brother_last_name.trim() : '';
                                    
                                    console.log('Initializing brother names:', {
                                        brotherA: { firstName: brotherAFirst, lastName: brotherALast },
                                        brotherB: { firstName: brotherBFirst, lastName: brotherBLast },
                                        rawSignup: signup
                                    });
                                    
                                    setBrotherA({ firstName: brotherAFirst, lastName: brotherALast });
                                    setBrotherB({ firstName: brotherBFirst, lastName: brotherBLast });
                                }
                            } else {
                                navigate(`/error/${errorTitle}/${"Rushee with this GTID does not exist"}`);
                            }
                        });

                    // Fetch this rushee's PIS questions (fixed questions always included;
                    // randomized category questions only once within 5 min of their PIS time).
                    await axios.get(`${api}/rushee/get-pis-questions/${gtid}`)
                        .then((response) => {
                            if (response.data.status === "success") {
                                const { available, reveal_at, questions: fetchedQuestions } = response.data.payload;
                                // Questions already come back sorted by `order` from the server.
                                setQuestions(fetchedQuestions);
                                setQuestionsAvailable(available);
                                setRevealAt(parseServerDate(reveal_at));
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

    // While the randomized questions are still hidden, poll and re-fetch from
    // the server once time's up so the assigned questions get drawn.
    useEffect(() => {
        if (loading || questionsAvailable || !revealAt) return;

        const tick = () => {
            const secondsLeft = Math.max(0, Math.round((revealAt.getTime() - Date.now()) / 1000));

            if (secondsLeft <= 0) {
                axios.get(`${api}/rushee/get-pis-questions/${gtid}`).then((response) => {
                    if (response.data.status === "success") {
                        const { available, reveal_at, questions: fetchedQuestions } = response.data.payload;
                        setQuestions(fetchedQuestions);
                        setQuestionsAvailable(available);
                        setRevealAt(parseServerDate(reveal_at));
                    }
                });
            }
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [loading, questionsAvailable, revealAt, api, gtid]);

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

    const performAutosave = useCallback(() => performPisAutosave({
        questions, answers, brotherA, brotherB, gtid, api, axios,
        setSaveStatus, setLastSaved,
    }), [questions, answers, brotherA, brotherB, gtid, api]);

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

    return (
        <div>
            {loading ? (
                <Loader />
            ) : !questionsAvailable ? (
                <PisQuestionsPending questions={questions} revealAt={revealAt} />
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

                            <PisProfileHeader rushee={rushee} />

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
                                            <PisSaveStatus saveStatus={saveStatus} lastSaved={lastSaved} />
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
                                
                                <PisBrotherFields
                                    rushee={rushee}
                                    brotherA={brotherA}
                                    brotherB={brotherB}
                                    collaboration={collaboration}
                                    currentUser={currentUser}
                                    handleBrotherAChange={handleBrotherAChange}
                                    handleBrotherBChange={handleBrotherBChange}
                                />

                                <PisQuestionResponses
                                    questions={questions}
                                    answers={answers}
                                    handleMCChange={handleMCChange}
                                    handleAnswerChange={handleAnswerChange}
                                    collaboration={collaboration}
                                    currentUser={currentUser}
                                />

                                {/* Save status footer */}
                                <div className="mt-8 pt-6 border-t border-apple-gray-200 flex items-center justify-between">
                                    <p className="text-apple-footnote text-apple-gray-500">
                                        All changes are automatically saved
                                    </p>
                                    <PisSaveStatus saveStatus={saveStatus} lastSaved={lastSaved} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
