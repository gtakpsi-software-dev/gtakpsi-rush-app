import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import apiClient from '../api/client';
import { MidtermModeContext } from './MidtermModeContext';

// Provide shared midterm-mode state loaded from the API.
export function MidtermModeProvider({ children }: { children: ReactNode }) {
    const [isMidtermMode, setIsMidtermMode] = useState(false);

    const refetchMidtermMode = useCallback(async () => {
        // Refresh midterm status, defaulting to disabled if the request fails.
        try {
            const res = await apiClient.get('/brother/rush-app/midterm-status');
            setIsMidtermMode(res.data?.midterm_mode ?? false);
        } catch {
            setIsMidtermMode(false);
        }
    }, []);

    useEffect(() => {
        // Fetch the initial midterm-mode status when the provider mounts.
        refetchMidtermMode();
    }, [refetchMidtermMode]);

    return (
        <MidtermModeContext.Provider value={{ isMidtermMode, refetchMidtermMode }}>
            {children}
        </MidtermModeContext.Provider>
    );
}
