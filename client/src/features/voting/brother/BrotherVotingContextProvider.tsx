import React, { useState } from "react";
import type { Rushee } from "./types";
import { BrotherVotingContext } from "./BrotherVotingContext";

export const BrotherVotingContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rushee, setRushee] = useState<Rushee | null>(null);
  const [question, setQuestion] = useState<string | null>(null);

  return (
    <BrotherVotingContext.Provider value={{ rushee, question, setRushee, setQuestion }}>
      {children}
    </BrotherVotingContext.Provider>
  );
};
