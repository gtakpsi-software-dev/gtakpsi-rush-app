import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { AdminVotingContextProvider, useAdminVotingContext } from "./AdminVotingContext";
import QuestionDisplay from "./QuestionDisplay";
import RusheePreviewCard from "./RusheePreviewCard";
import RusheeComments from "./RusheeComments";
import VoteSummary from "./VoteSummary";
import BrotherList from "./BrotherList";
import { Brother } from "./types";
import NotFound from "../404";
import { auth } from "../../firebase";

// Connection status type
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

// Parse allowlist once at module level
const ALLOWLIST = ((import.meta.env as any).VITE_ADMIN_ALLOWLIST || "")
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter((e: string) => e.length > 0);

function Content() {

    const { votes, rushee, question, setVotes, setRushee, setQuestion } = useAdminVotingContext();

    const websocketAPI: string = (import.meta.env as any).VITE_BROADCASTER_API_PREFIX;
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const navigate = useNavigate();
    const [authorized, setAuthorized] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);
    const [authChecked, setAuthChecked] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');

    const storedUser: string | null = localStorage.getItem('user')
    
    // Memoize user to prevent WebSocket reconnecting on every render
    const user: Brother | null = useMemo(() => {
        return storedUser ? JSON.parse(storedUser) : null;
    }, [storedUser]);

    useEffect(() => {
        // Only run auth check once
        if (authChecked) return;

        const unsubscribe = auth.onAuthStateChanged(async (current) => {
            if (!storedUser || !current) {
                setAuthLoading(false);
                setAuthChecked(true);
                navigate("/login");
                return;
            }
            try {
                const tokenResult = await current.getIdTokenResult(true);
                const isAdmin = tokenResult.claims?.admin === true;
                const email = current.email ? current.email.toLowerCase() : "";
                const isAllowlisted = email && ALLOWLIST.includes(email);
                if (!(isAdmin || isAllowlisted)) {
                    setAuthLoading(false);
                    setAuthChecked(true);
                    navigate("/login");
                    return;
                }
                setAuthorized(true);
                setAuthChecked(true);
            } catch (_err) {
                setAuthChecked(true);
                navigate("/login");
            } finally {
                setAuthLoading(false);
            }
        });
        return () => unsubscribe();
    }, [storedUser, navigate, authChecked]);

    // WebSocket connection with automatic reconnection
    const connectWebSocket = useCallback(() => {
        if (!authorized || !user) return;

        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        setConnectionStatus('connecting');
        const ws = new WebSocket(`${websocketAPI}/admin/${user._id}`);
        socketRef.current = ws;

        ws.onopen = () => {
            console.log("WebSocket connected");
            setConnectionStatus('connected');
            reconnectAttemptsRef.current = 0; // Reset reconnect counter on successful connection
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                console.log(msg)

                if (msg.type === "vote_update") {
                    setVotes(msg.votes); // expects array of vote objects
                }

                if (msg.type === "rushee_update") {
                    const parsedRushee =
                        typeof msg.rushee === "string"
                            ? JSON.parse(msg.rushee)
                            : msg.rushee;

                    setRushee(parsedRushee);
                }

                if (msg.type === "question_update") {
                    setQuestion(msg.question)
                }

            } catch (err) {
                console.error("Error parsing WebSocket message", err);
            }
        };

        ws.onclose = () => {
            console.log("WebSocket closed");
            setConnectionStatus('disconnected');
            
            // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
            const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
            reconnectAttemptsRef.current++;
            
            console.log(`Reconnecting in ${backoffMs}ms (attempt ${reconnectAttemptsRef.current})`);
            reconnectTimeoutRef.current = setTimeout(() => {
                connectWebSocket();
            }, backoffMs);
        };

        ws.onerror = (e) => {
            console.error("WebSocket error", e);
            ws.close(); // Trigger onclose for reconnection
        };
    }, [authorized, user, websocketAPI, setVotes, setRushee, setQuestion]);

    useEffect(() => {
        if (!authorized || !user) return;

        connectWebSocket();

        return () => {
            // Cleanup on unmount
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, [connectWebSocket, authorized, user]);

    const handleSetQuestion = (value: string) => {
        console.log("Set question to:", value);
    };

    const handleSetRushee = (gtid: string) => {
        console.log("Set rushee to GTID:", gtid);
    };


    if (!storedUser || authLoading) {
        return null;
    }

    if (!authorized || !user) {
        return null;
    }

    return (
        <div className="w-screen h-screen flex overflow-visible">
            <Navbar />
            {/* Connection Status Indicator */}
            {connectionStatus === 'disconnected' && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-red-100 text-red-700 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Connection lost. Reconnecting...</span>
                </div>
            )}
            {connectionStatus === 'connecting' && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Connecting...</span>
                </div>
            )}
            <div className="w-[65%] h-full pt-24 bg-white border-r border-apple-gray-200 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-8 py-6 pb-24">
                    <div className="flex flex-col space-y-6">
                        <QuestionDisplay />
                        <RusheePreviewCard />
                        <RusheeComments />
                    </div>
                </div>
            </div>
            <div className="w-[35%] h-full pt-24 bg-white border-r border-apple-gray-200 overflow-y-auto">
                <div className="px-6 py-6 pb-24">
                    <VoteSummary showBreakdown={true} />
                    <BrotherList/>
                </div>
            </div>
        </div>
    )

}

export default function AdminVotingDashboard() {

    return (
        <AdminVotingContextProvider>
            <Content />
        </AdminVotingContextProvider>
    )
}