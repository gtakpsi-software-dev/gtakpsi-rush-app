import React, { useState, useEffect } from "react";
import type { Vote, Rushee, Brother } from "./types";
import { getAllBrothers } from "../../brothers/getAllBrothers";
import { AdminVotingContext } from "./AdminVotingContext";

// Provide voting state and load the brother directory for the admin dashboard.
export const AdminVotingContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [rushee, setRushee] = useState<Rushee | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [brothers, setBrothers] = useState<Brother[]>([]);
  const [, setLoading] = useState(true);

  useEffect(() => {
      // Fetch the brother directory when the provider mounts.
    // Load brothers into voting state and finish the loading flag even on failure.
    const fetchBrothers = async () => {
      try {
        const brothersList = await getAllBrothers();
        setBrothers(brothersList as Brother[]);
      } catch (error) {
        console.error("Error fetching brothers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBrothers();
  }, []);

  return (
    <AdminVotingContext.Provider value={{ votes, rushee, question, brothers, setVotes, setRushee, setQuestion }}>
      {children}
    </AdminVotingContext.Provider>
  );
};
