import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { BrotherVotingContextProvider, useBrotherVotingContext } from "./BrotherVotingContext";
import QuestionBanner from "./QuestionBanner";
import RusheePreviewCard from "./RusheePreviewCard";
import RusheeComments from "./RusheeComments";
import NotFound from "../404";
import { Brother } from "./types";

function Content() {
  const { rushee, question, setRushee, setQuestion } = useBrotherVotingContext();
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
    const ws = new WebSocket(`${websocketAPI}/voter/${user._id}`);
    socketRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log(msg)
        if (msg.type === "rushee_update") {
          const parsedRushee =
            typeof msg.rushee === "string" ? JSON.parse(msg.rushee) : msg.rushee;
          setRushee(parsedRushee);
        }

        if (msg.type === "question_update") {
          setQuestion(msg.question);
        }
      } catch (err) {
        console.error("Error parsing WebSocket message", err);
      }
    };

    ws.onclose = () => console.log("WebSocket closed");
    ws.onerror = (e) => console.error("WebSocket error", e);

    return () => ws.close();
  }, [setRushee, websocketAPI]);

  return (
    <div className="w-screen h-screen overflow-auto flex flex-col">
      {/* Fixed Navbar */}
      <div className="fixed top-0 left-0 w-full z-50">
        <Navbar />
      </div>

      {/* Offset the height of the fixed navbar (adjust height if needed) */}
      <div className="pt-20 sm:pt-24 px-6 w-full max-w-6xl mx-auto">
        <QuestionBanner />
        <RusheePreviewCard />
        <RusheeComments />
      </div>
    </div>
  );
}

export default function BrotherVotingPage() {
  return (
    <BrotherVotingContextProvider>
      <Content />
    </BrotherVotingContextProvider>
  );
}
