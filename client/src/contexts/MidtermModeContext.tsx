import { createContext, useContext } from 'react';

type MidtermModeValue = {
    isMidtermMode: boolean;
    refetchMidtermMode: () => void;
};

export const MidtermModeContext = createContext<MidtermModeValue>({
    isMidtermMode: false,
    // Leave state unchanged when no midterm provider is mounted.
    refetchMidtermMode: () => {},
});

// Read the shared midterm-mode state and refresh action.
export function useMidtermMode() {
    return useContext(MidtermModeContext);
}
