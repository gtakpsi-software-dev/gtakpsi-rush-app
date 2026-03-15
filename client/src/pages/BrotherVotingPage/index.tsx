import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
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
import { useMidtermMode } from "../../contexts/MidtermModeContext";

// Connection status type
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

function Content() {
  const { rushee, question, setRushee, setQuestion } = useBrotherVotingContext();
  const { isMidtermMode } = useMidtermMode();
  const websocketAPI: string = (import.meta.env as any).VITE_BROADCASTER_API_PREFIX;
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const navigate = useNavigate();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  
  const storedUser: string | null = localStorage.getItem('user');

  // Memoize user to prevent WebSocket reconnecting on every render
  const user: Brother | null = useMemo(() => {
    return storedUser ? JSON.parse(storedUser) : null;
  }, [storedUser]);

  useEffect(() => {
    if (!storedUser) {
      navigate("/login");
      return;
    }
  }, [storedUser, navigate]);

  // WebSocket connection with automatic reconnection
  const connectWebSocket = useCallback(() => {
    if (!user) return;

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnectionStatus('connecting');
    const ws = new WebSocket(`${websocketAPI}/voter/${user._id}`);
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
  }, [user, websocketAPI, setRushee, setQuestion]);

  useEffect(() => {
    if (!user) return;

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
  }, [connectWebSocket, user]);

  if (!storedUser || !user) {
    return null;
  }

  if (isMidtermMode) {
    return (
      <div className="w-screen h-screen flex flex-col bg-apple-gray-50 overflow-hidden">
        {/* Fixed Navbar */}
        <div className="fixed top-0 left-0 w-full z-50">
          <Navbar />
        </div>

        {/* Midterm layout: left = rushee profile, right = question + vote */}
        <div className="pt-20 pb-8 px-8 flex-1 flex gap-8 overflow-hidden">
          {/* Left column: image + info stacked vertically */}
          <div className="w-72 flex-shrink-0 flex flex-col">
            <RusheePreviewCard midtermMode />
          </div>

          {/* Right column: question + buttons fills remaining space */}
          <div className="flex-1 flex flex-col min-w-0">
            <QuestionBanner midtermMode />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-auto flex flex-col bg-apple-gray-50">
      {/* Fixed Navbar */}
      <div className="fixed top-0 left-0 w-full z-50">
        <Navbar />
      </div>

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
