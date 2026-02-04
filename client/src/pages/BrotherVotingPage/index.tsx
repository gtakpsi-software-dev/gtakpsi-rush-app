import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { BrotherVotingContextProvider, useBrotherVotingContext } from "./BrotherVotingContext";
import QuestionBanner from "./QuestionBanner";
import RusheePreviewCard from "./RusheePreviewCard";
import RusheeComments from "./RusheeComments";
import RusheePISInfo from "./RusheePISInfo";
import RusheeScores from "./RusheeScores";
import RusheeBidCommNotes from "./RusheeBidCommNotes";
import { Brother } from "./types";

function Content() {
  const { rushee, question, setRushee, setQuestion } = useBrotherVotingContext();
  const websocketAPI: string = (import.meta.env as any).VITE_BROADCASTER_API_PREFIX;
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
    <div className="w-screen h-screen overflow-auto flex flex-col bg-apple-gray-50">
      {/* Fixed Navbar */}
      <div className="fixed top-0 left-0 w-full z-50">
        <Navbar />
      </div>

      {/* Main content area */}
      <div className="pt-20 sm:pt-24 px-4 pb-32 flex-1">
        <div className="w-full max-w-7xl mx-auto flex flex-col gap-4">
          {/* Question Banner */}
          <QuestionBanner />
          
          {/* Rushee Info Card */}
          <RusheePreviewCard />
          
          {/* Four-panel grid layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Scores Panel */}
            <div className="card-apple flex flex-col min-h-[320px]">
              <div className="p-5 border-b border-apple-gray-200 flex-shrink-0">
                <h3 className="text-xl font-semibold text-black">Scores</h3>
              </div>
              <div className="p-5 overflow-auto flex-1 max-h-[400px]" data-scrollable>
                <RusheeScores />
              </div>
            </div>
            
            {/* Bid Comm Notes Panel */}
            <div className="card-apple flex flex-col min-h-[320px]">
              <div className="p-5 border-b border-apple-gray-200 flex-shrink-0">
                <h3 className="text-xl font-semibold text-black">Bid Committee Notes</h3>
              </div>
              <div className="p-5 overflow-auto flex-1 max-h-[400px]" data-scrollable>
                <RusheeBidCommNotes />
              </div>
            </div>
            
            {/* Comments Panel */}
            <div className="card-apple flex flex-col min-h-[320px]">
              <div className="p-5 border-b border-apple-gray-200 flex-shrink-0">
                <h3 className="text-xl font-semibold text-black">Comments</h3>
              </div>
              <div className="p-5 overflow-auto flex-1 max-h-[400px]" data-scrollable>
                <RusheeComments />
              </div>
            </div>
            
            {/* PIS Info Panel */}
            <div className="card-apple flex flex-col min-h-[320px]">
              <div className="p-5 border-b border-apple-gray-200 flex-shrink-0">
                <h3 className="text-xl font-semibold text-black">PIS Information</h3>
              </div>
              <div className="p-5 overflow-auto flex-1 max-h-[400px]" data-scrollable>
                <RusheePISInfo />
              </div>
            </div>
          </div>
        </div>
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
