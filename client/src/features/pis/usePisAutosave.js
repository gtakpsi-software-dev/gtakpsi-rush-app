import { useCallback, useEffect } from "react";
import { performPisAutosave } from "./performPisAutosave";

// Debounce interview saves and delay activation until initial data has settled.
export function usePisAutosave({
    questions, answers, brotherA, brotherB, gtid, api, axios,
    setSaveStatus, setLastSaved, loading, isInitialLoadRef, autosaveTimeoutRef,
}) {
    const performAutosave = useCallback(/* Save the current questions, answers, and interviewer names. */ () => performPisAutosave({
        questions, answers, brotherA, brotherB, gtid, api, axios,
        setSaveStatus, setLastSaved,
    }), [questions, answers, brotherA, brotherB, gtid, api, axios, setSaveStatus, setLastSaved]);

    useEffect(() => {
        // Schedule autosave after edits once initial hydration is complete.
        // Avoid posting data that was just loaded from the server.
        if (isInitialLoadRef.current) {
            return;
        }

        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
        }

        autosaveTimeoutRef.current = setTimeout(() => {
            // Run autosave after the two-second debounce.
            performAutosave();
        }, 2000);

        return () => {
            // Cancel the pending autosave when the effect is cleaned up.
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
            }
        };
    }, [answers, brotherA, brotherB, performAutosave, isInitialLoadRef, autosaveTimeoutRef]);

    useEffect(() => {
        // Schedule autosave activation after questions finish loading.
        if (!loading && questions.length > 0) {
            // Delay activation so hydration does not trigger an immediate save.
            const timer = setTimeout(() => {
                // Allow autosave after the hydration delay.
                isInitialLoadRef.current = false;
            }, 1000);
            return /* Cancel pending autosave activation. */ () => clearTimeout(timer);
        }
    }, [loading, questions, isInitialLoadRef]);
}
