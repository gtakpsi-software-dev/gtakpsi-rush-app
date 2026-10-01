import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AdminVotingContextProvider, useAdminVotingContext } from "./AdminVotingContext";
import AdminVotingDashboardView from "./AdminVotingDashboardView";
import type { Brother, ConnectionStatus } from "./types";
import NotFound from "../NotFound";
import { auth } from "../../firebase";
import { realtimeBaseUrls } from "../../config/realtimeBaseUrls";

// Parse allowlist once at module level
const ALLOWLIST = ((import.meta.env as any).VITE_ADMIN_ALLOWLIST || "")
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter((e: string) => e.length > 0);

function Content() {

    const { votes, rushee, question, setVotes, setRushee, setQuestion } = useAdminVotingContext();

    const votingWebSocketUrl: string = realtimeBaseUrls.voting;
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
        const ws = new WebSocket(`${votingWebSocketUrl}/admin/${user._id}`);
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
    }, [authorized, user, votingWebSocketUrl, setVotes, setRushee, setQuestion]);

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

    return <AdminVotingDashboardView connectionStatus={connectionStatus} />;

}

export default function AdminVotingDashboard() {

    return (
        <AdminVotingContextProvider>
            <Content />
        </AdminVotingContextProvider>
    )
}
