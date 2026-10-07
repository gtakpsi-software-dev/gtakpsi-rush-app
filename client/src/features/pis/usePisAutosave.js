import { useCallback, useEffect } from "react";
import { performPisAutosave } from "./performPisAutosave";

export function usePisAutosave({
    questions, answers, brotherA, brotherB, gtid, api, axios,
    setSaveStatus, setLastSaved, loading, isInitialLoadRef, autosaveTimeoutRef,
}) {
    const performAutosave = useCallback(() => performPisAutosave({
        questions, answers, brotherA, brotherB, gtid, api, axios,
        setSaveStatus, setLastSaved,
    }), [questions, answers, brotherA, brotherB, gtid, api, axios, setSaveStatus, setLastSaved]);

    useEffect(() => {
        // Avoid posting data that was just loaded from the server.
        if (isInitialLoadRef.current) {
            return;
        }

        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
        }

        autosaveTimeoutRef.current = setTimeout(() => {
            performAutosave();
        }, 2000);

        return () => {
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
            }
        };
    }, [answers, brotherA, brotherB, performAutosave, isInitialLoadRef, autosaveTimeoutRef]);

    useEffect(() => {
        if (!loading && questions.length > 0) {
            // Delay activation so hydration does not trigger an immediate save.
            const timer = setTimeout(() => {
                isInitialLoadRef.current = false;
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [loading, questions, isInitialLoadRef]);
}
