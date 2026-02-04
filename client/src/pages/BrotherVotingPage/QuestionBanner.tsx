import React, { useState, useEffect } from "react";
import SplitText from "../../components/ReactBitsComponents/SplitText";
import { Brother } from "./types";
import { useBrotherVotingContext } from "./BrotherVotingContext";
import { toast } from "react-toastify";
import NotFound from "../404";
import axios from 'axios'

const votingOptions = ["Yes", "No", "Abstain"];

export default function QuestionBanner() {
    const { question, setQuestion } = useBrotherVotingContext();
    const [hasVoted, setHasVoted] = useState(false);
    const [submittedVote, setSubmittedVote] = useState<string | null>(null);

    const storedUser: string | null = localStorage.getItem('user')

    if (!storedUser) {
        return <NotFound />
    }

    const user: Brother = JSON.parse(storedUser)

    const api = import.meta.env.VITE_API_PREFIX;

    // Reset vote state when question changes
    useEffect(() => {
        setHasVoted(false);
        setSubmittedVote(null);
    }, [question]);

    const handleVote = async (vote: string) => {

        if (!question) {
            toast.error("No question has been set", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
            return;
        }

        const payload = {
            brother_id: user._id,
            first_name: user.firstname,
            last_name: user.lastname,
            vote: vote
        }

        console.log(payload)

        await toast.promise(
            (async () => {

                const response = await axios.post(`${api}/rushee/vote`, payload);
                console.log(response.data)

                if (response.data.status !== "success") {
                    const code = response.data.status;

                    if (code === "duplicate") {
                        // If they already voted, show the voted state
                        setHasVoted(true);
                        setSubmittedVote(vote);
                        throw new Error("You have already voted for this rushee.");
                    }

                    if (code === "ineligible") {
                        throw new Error("You are not eligible to vote, contact Visakhi if this is incorrect.");
                    }
                    throw new Error("Vote failed for unknown reason.");
                }

                // Vote was successful, update state
                setHasVoted(true);
                setSubmittedVote(vote);
                return response;
            })(),
            {
                pending: "Sending vote to admin...",
                success: "Vote sent successfully!",
                error: {
                    render({ data }) {
                        // data is the error object thrown
                        return (data as any).message || "Failed to upload vote.";
                    },
                },
            },
            {
                position: "top-center",
                theme: "light",
            }
        );
    };

    return (
        <div className="relative w-full rounded-apple-xl overflow-hidden bg-gradient-to-br from-apple-gray-100 via-white to-apple-gray-50 shadow-md flex-shrink-0">
            {/* Floating question marks */}
            {Array.from({ length: 8 }).map((_, idx) => (
                <span
                    key={idx}
                    className="absolute text-[20px] sm:text-[28px] text-apple-gray-700 opacity-30 animate-float pointer-events-none select-none"
                    style={{
                        top: `${Math.random() * 100}%`,
                        left: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 5}s`,
                        transform: `translate(-50%, -50%)`,
                    }}
                >
                    ?
                </span>
            ))}

            {/* Centered animated question */}
            <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6 px-8 py-8">
                <SplitText
                    key={question}
                    text={question ? question : "No Question Set"}
                    splitType="words"
                    className="text-3xl sm:text-4xl font-semibold text-apple-gray-800 drop-shadow-sm"
                    duration={0.5}
                    delay={60}
                />

                {/* Voting options or success indicator */}
                <div className="flex gap-4 flex-shrink-0">
                    {hasVoted ? (
                        <div className="flex items-center gap-3 px-6 py-3 rounded-apple bg-green-100 border border-green-200">
                            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <span className="text-green-800 font-semibold text-lg">
                                Voted
                            </span>
                        </div>
                    ) : (
                        votingOptions.map((option) => (
                            <button
                                key={option}
                                onClick={() => handleVote(option)}
                                className="px-6 py-3 rounded-apple bg-apple-gray-200 hover:bg-apple-gray-300 active:scale-[0.97] transition text-apple-gray-800 font-semibold text-lg"
                            >
                                {option}
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
