import { useEffect, useState, useRef, useCallback } from "react";
import Loader from "../components/Loader";
import Navbar from "../components/Navbar";
import axios from "axios";
import { useCollaboration } from "../hooks/useCollaboration";

import { verifyUser } from "../features/auth/verifyUser";
import { useNavigate, useParams } from "react-router-dom";
import { auth } from "../firebase";

import "react-toastify/dist/ReactToastify.css";

import PisProfileHeader from "../features/pis/PisProfileHeader";
import PisQuestionsCard from "../features/pis/PisQuestionsCard";
import PisQuestionsPending from "../features/pis/PisQuestionsPending";
import { SAVE_STATUS } from "../features/pis/saveStatus";
import { applyDocumentState, applyRemoteUpdates } from "../features/pis/collaborationState";
import { performPisAutosave } from "../features/pis/performPisAutosave";
import { loadPisPageData } from "../features/pis/loadPisPageData";
import { startPisRevealPolling } from "../features/pis/startPisRevealPolling";
import { createPisAnswerHandlers } from "../features/pis/createPisAnswerHandlers";

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
        if (loading) {
            loadPisPageData({
                verifyUser,
                navigate,
                errorTitle,
                errorDescription,
                currentUser,
                auth,
                getStoredUser: () => localStorage.getItem('user'),
                setCurrentUser,
                get: (...args) => axios.get(...args),
                api,
                gtid,
                setRushee,
                setAnswers,
                setBrotherA,
                setBrotherB,
                setQuestions,
                setQuestionsAvailable,
                setRevealAt,
                setLoading,
                logError: (error) => console.log(error),
            });
        }
    }, [loading, api, gtid, navigate]);

    // While the randomized questions are still hidden, poll and re-fetch from
    // the server once time's up so the assigned questions get drawn.
    useEffect(() => {
        if (loading || questionsAvailable || !revealAt) return;

        return startPisRevealPolling({
            revealAt,
            api,
            gtid,
            get: (...args) => axios.get(...args),
            setQuestions,
            setQuestionsAvailable,
            setRevealAt,
            now: () => Date.now(),
            scheduleInterval: (callback, delay) => setInterval(callback, delay),
            clearScheduledInterval: (interval) => clearInterval(interval),
        });
    }, [loading, questionsAvailable, revealAt, api, gtid]);

    const { handleAnswerChange, handleMCChange } = createPisAnswerHandlers({
        setAnswers,
        collaboration,
    });

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

                            <PisQuestionsCard
                                rushee={rushee}
                                brotherA={brotherA}
                                brotherB={brotherB}
                                collaboration={collaboration}
                                currentUser={currentUser}
                                handleBrotherAChange={handleBrotherAChange}
                                handleBrotherBChange={handleBrotherBChange}
                                questions={questions}
                                answers={answers}
                                handleMCChange={handleMCChange}
                                handleAnswerChange={handleAnswerChange}
                                saveStatus={saveStatus}
                                lastSaved={lastSaved}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
