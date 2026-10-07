import { createContext, useContext } from "react";
import type { BrotherVotingContextType } from "./types";

export const BrotherVotingContext = createContext<BrotherVotingContextType | null>(null);

export const useBrotherVotingContext = () => {

    const context = useContext(BrotherVotingContext);
    if (!context) {
        throw new Error("MUST use context within some provider");
    }
    return context;

}
