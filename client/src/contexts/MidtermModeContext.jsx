import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../js/apiClient';

const MidtermModeContext = createContext({
    isMidtermMode: false,
    refetchMidtermMode: () => {},
});

export function MidtermModeProvider({ children }) {
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
