import { createContext, useContext } from 'react';

type MidtermModeValue = {
    isMidtermMode: boolean;
    refetchMidtermMode: () => void;
};

export const MidtermModeContext = createContext<MidtermModeValue>({
    isMidtermMode: false,
    refetchMidtermMode: () => {},
});

export function useMidtermMode() {
    return useContext(MidtermModeContext);
}
