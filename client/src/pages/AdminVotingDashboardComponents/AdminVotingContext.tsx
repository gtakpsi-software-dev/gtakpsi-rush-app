import React, { createContext, useContext, useState, useEffect } from "react";
import { Vote, AdminVotingContextType, Rushee, Brother } from "./types";
import { getAllBrothers } from "../../js/user";

const AdminVotingContext = createContext<AdminVotingContextType | null>(null);

/**
 * 
 * @returns 
 */
export const useAdminVotingContext = () => {

  const context = useContext(AdminVotingContext);
  if (!context) {
    throw new Error("MUST use context within some provider");
  }
  return context;

}

export const AdminVotingContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [rushee, setRushee] = useState<Rushee | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [brothers, setBrothers] = useState<Brother[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
