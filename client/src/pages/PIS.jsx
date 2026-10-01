import { useState, useRef } from "react";
import Loader from "../components/Loader";
import axios from "axios";
import { usePisCollaborationState } from "../features/pis/usePisCollaborationState";

import { useNavigate, useParams } from "react-router-dom";

import "react-toastify/dist/ReactToastify.css";

import PisInterviewView from "../features/pis/PisInterviewView";
import PisQuestionsPending from "../features/pis/PisQuestionsPending";
import { SAVE_STATUS } from "../features/pis/saveStatus";
import { usePisAutosave } from "../features/pis/usePisAutosave";
import { usePisPageBootstrap } from "../features/pis/usePisPageBootstrap";
import { usePisRevealPolling } from "../features/pis/usePisRevealPolling";
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

    const collaboration = usePisCollaborationState({
        gtid, currentUser, setBrotherA, setBrotherB, setAnswers,
    });

    const api = import.meta.env.VITE_API_PREFIX;

    usePisPageBootstrap({
        loading, navigate, currentUser, api, gtid, setCurrentUser,
        setRushee, setAnswers, setBrotherA, setBrotherB, setQuestions,
        setQuestionsAvailable, setRevealAt, setLoading,
    });

    usePisRevealPolling({
        loading, questionsAvailable, revealAt, api, gtid,
        setQuestions, setQuestionsAvailable, setRevealAt,
    });

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

    usePisAutosave({
        questions, answers, brotherA, brotherB, gtid, api, axios,
        setSaveStatus, setLastSaved, loading, isInitialLoadRef, autosaveTimeoutRef,
    });

    return (
        <div>
            {loading ? (
                <Loader />
            ) : !questionsAvailable ? (
                <PisQuestionsPending questions={questions} revealAt={revealAt} />
            ) : (
                <PisInterviewView
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
            )}
        </div>
    );
}
