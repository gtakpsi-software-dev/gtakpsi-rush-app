import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import apiClient from '../api/client';
import { MidtermModeContext } from './MidtermModeContext';

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
