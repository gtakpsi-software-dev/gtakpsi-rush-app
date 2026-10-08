import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminVotingContext } from "../features/voting/admin/AdminVotingContext";
import { AdminVotingContextProvider } from "../features/voting/admin/AdminVotingContextProvider";
import AdminVotingDashboardView from "../features/voting/admin/AdminVotingDashboardView";
import type { Brother, ConnectionStatus } from "../features/voting/admin/types";
import { auth } from "../firebase";
import { realtimeBaseUrls } from "../config/realtimeBaseUrls";
import { useAdminVotingSocket } from "../features/voting/admin/useAdminVotingSocket";
import { parseAdminAllowlist } from "../features/auth/parseAdminAllowlist";

const ALLOWLIST = parseAdminAllowlist(import.meta.env.VITE_ADMIN_ALLOWLIST);

// Verify admin access and connect live voting state before rendering the dashboard.
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
    
    // Parse the stored user once per value so renders do not reconnect the WebSocket.
    const user: Brother | null = useMemo(() => {
        return storedUser ? JSON.parse(storedUser) : null;
    }, [storedUser]);

    useEffect(() => {
        // Subscribe to authentication until the initial admin check is complete.
        // Only run auth check once
        if (authChecked) return;

        const unsubscribe = auth.onAuthStateChanged(async (current) => {
            // Authorize an admin claim or allowlisted email, otherwise redirect to login.
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
        return /* Remove the authentication listener. */ () => unsubscribe();
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

// Provide shared admin voting state around the dashboard.
export default function AdminVotingDashboard() {

    return (
        <AdminVotingContextProvider>
            <Content />
        </AdminVotingContextProvider>
    )
}
