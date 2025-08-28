import React, { useEffect, useRef } from "react";
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

function Content() {

    const { votes, rushee, question, setVotes, setRushee, setQuestion } = useAdminVotingContext();

    const websocketAPI: string = import.meta.env.VITE_BROADCASTER_API_PREFIX;
    const socketRef = useRef<WebSocket | null>(null);
    const navigate = useNavigate();

    const storedUser: string | null = localStorage.getItem('user')

    useEffect(() => {
        if (!storedUser) {
            navigate("/login");
            return;
        }
    }, [storedUser, navigate]);

    if (!storedUser) {
        return null;
    }

    const user: Brother = JSON.parse(storedUser)

    useEffect(() => {

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
    }, [setVotes]);

    const handleSetQuestion = (value: string) => {
        console.log("Set question to:", value);
    };

    const handleSetRushee = (gtid: string) => {
        console.log("Set rushee to GTID:", gtid);
    };


    return (
        <div className="w-screen h-screen flex overflow-visible">
            <Navbar />
            <div className="w-[65%] h-full p-6 pt-24 bg-white border-r border-apple-gray-200">
                <div className="flex flex-col space-y-6">
                    <QuestionDisplay />
                    <RusheePreviewCard />
                    <RusheeComments />
                </div>
            </div>
            <div className="w-[35%] h-full p-6 pt-24 bg-white border-r border-apple-gray-200">
                <VoteSummary showBreakdown={true} />
                <BrotherList/>
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