import { createContext, useContext } from "react";
import type { AdminVotingContextType } from "./types";

export const AdminVotingContext = createContext<AdminVotingContextType | null>(null);

export const useAdminVotingContext = () => {
  const context = useContext(AdminVotingContext);
  if (!context) {
    throw new Error("MUST use context within some provider");
  }
  return context;
};
