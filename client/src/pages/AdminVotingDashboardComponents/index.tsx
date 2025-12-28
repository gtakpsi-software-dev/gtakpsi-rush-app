import React, { useEffect, useRef, useState } from "react";
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

function Content() {

    const { votes, rushee, question, setVotes, setRushee, setQuestion } = useAdminVotingContext();

    const websocketAPI: string = (import.meta.env as any).VITE_BROADCASTER_API_PREFIX;
    const socketRef = useRef<WebSocket | null>(null);
    const navigate = useNavigate();
    const [authorized, setAuthorized] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);

    const storedUser: string | null = localStorage.getItem('user')
    const allowlist = ((import.meta.env as any).VITE_ADMIN_ALLOWLIST || "")
        .split(",")
        .map((e: string) => e.trim().toLowerCase())
        .filter((e: string) => e.length > 0);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (current) => {
            if (!storedUser || !current) {
                setAuthLoading(false);
                navigate("/login");
                return;
            }
            try {
                const tokenResult = await current.getIdTokenResult(true);
                const isAdmin = tokenResult.claims?.admin === true;
                const email = current.email ? current.email.toLowerCase() : "";
                const isAllowlisted = email && allowlist.includes(email);
                if (!(isAdmin || isAllowlisted)) {
                    setAuthLoading(false);
                    navigate("/login");
                    return;
                }
                setAuthorized(true);
            } catch (_err) {
                navigate("/login");
            } finally {
                setAuthLoading(false);
            }
        });
        return () => unsubscribe();
    }, [storedUser, navigate, allowlist]);

    const user: Brother | null = storedUser ? JSON.parse(storedUser) : null;

    useEffect(() => {

        if (!authorized || !user) return;

        const ws = new WebSocket(`${websocketAPI}/admin/${user._id}`);
        socketRef.current = ws;

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                console.log(msg)

                if (msg.type === "vote_update") {
                    setVotes(msg.votes); // expects array of vote objects
                    console.log(votes)
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

        ws.onclose = () => console.log("WebSocket closed");
        ws.onerror = (e) => console.error("WebSocket error", e);

        return () => ws.close();
    }, [setVotes, authorized, user, websocketAPI]);

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