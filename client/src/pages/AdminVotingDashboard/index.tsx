import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminVotingContext } from "./AdminVotingContext";
import { AdminVotingContextProvider } from "./AdminVotingContextProvider";
import AdminVotingDashboardView from "./AdminVotingDashboardView";
import type { Brother, ConnectionStatus } from "./types";
import { auth } from "../../firebase";
import { realtimeBaseUrls } from "../../config/realtimeBaseUrls";
import { useAdminVotingSocket } from "./useAdminVotingSocket";
import { parseAdminAllowlist } from "../../features/auth/parseAdminAllowlist";

const ALLOWLIST = parseAdminAllowlist(import.meta.env.VITE_ADMIN_ALLOWLIST);

function Content() {

    const { setVotes, setRushee, setQuestion } = useAdminVotingContext();

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
            } catch {
                setAuthChecked(true);
                navigate("/login");
            } finally {
                setAuthLoading(false);
            }
        });
        return () => unsubscribe();
    }, [storedUser, navigate, authChecked]);

    useAdminVotingSocket({
        authorized, user, votingWebSocketUrl, socketRef,
        reconnectTimeoutRef, reconnectAttemptsRef, setConnectionStatus,
        setVotes, setRushee, setQuestion,
    });

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
