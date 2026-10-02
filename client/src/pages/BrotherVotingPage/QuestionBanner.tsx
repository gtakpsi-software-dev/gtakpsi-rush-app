import { useState, useEffect } from "react";
import QuestionBannerView from "./QuestionBannerView";
import { Brother } from "../../features/voting/brother/types";
import { useBrotherVotingContext } from "../../features/voting/brother/BrotherVotingContext";
import { toast } from "react-toastify";
import NotFound from "../NotFound";
import axios from 'axios'

interface Props {
    midtermMode?: boolean;
}

/**
 * Question Banner Summary:
 * - Registers the vote reset effect on every render to keep hook order stable.
 * - Keeps the missing-user gate, vote flow, and both layouts unchanged.
 */
export default function QuestionBanner({ midtermMode = false }: Props) {
    const { question } = useBrotherVotingContext();
    const [hasVoted, setHasVoted] = useState(false);
    const [, setSubmittedVote] = useState<string | null>(null);

    const storedUser: string | null = localStorage.getItem('user')

    // A missing stored user still renders NotFound, but must not skip a hook.
    useEffect(() => {
        setHasVoted(false);
        setSubmittedVote(null);
    }, [question]);

    if (!storedUser) {
        return <NotFound />
    }

    const user: Brother = JSON.parse(storedUser)

    const api = import.meta.env.VITE_API_PREFIX;

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
        <QuestionBannerView
            midtermMode={midtermMode}
            question={question}
            hasVoted={hasVoted}
            onVote={handleVote}
        />
    );
}
