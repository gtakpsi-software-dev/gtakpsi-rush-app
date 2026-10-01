import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import apiClient from '../api/client';

type MidtermModeValue = {
    isMidtermMode: boolean;
    refetchMidtermMode: () => void;
};

const MidtermModeContext = createContext<MidtermModeValue>({
    isMidtermMode: false,
    refetchMidtermMode: () => {},
});

/**
 * Midterm Mode Summary:
 * - Types the provider contract while retaining its initial false value and refresh effect.
 * - Failed status requests still reset the mode to false; no request behavior changes.
 */
export function MidtermModeProvider({ children }: { children: ReactNode }) {
    const [isMidtermMode, setIsMidtermMode] = useState(false);

    const refetchMidtermMode = useCallback(async () => {
        try {
            const res = await apiClient.get('/brother/rush-app/midterm-status');
            setIsMidtermMode(res.data?.midterm_mode ?? false);
        } catch {
            setIsMidtermMode(false);
        }
    }, []);

    useEffect(() => {
        refetchMidtermMode();
    }, [refetchMidtermMode]);

    return (
        <MidtermModeContext.Provider value={{ isMidtermMode, refetchMidtermMode }}>
            {children}
        </MidtermModeContext.Provider>
    );
}

export function useMidtermMode() {
    return useContext(MidtermModeContext);
}
