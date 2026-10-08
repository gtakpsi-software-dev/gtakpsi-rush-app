import { useEffect } from 'react';
import axios from 'axios';

import { startPisRevealPolling } from './startPisRevealPolling';

// Manage polling for questions that have not yet been revealed.
export function usePisRevealPolling({
    loading,
    questionsAvailable,
    revealAt,
    api,
    gtid,
    setQuestions,
    setQuestionsAvailable,
    setRevealAt,
}) {
    useEffect(() => {
        // Start reveal polling when loading is complete and a reveal time is available.
        if (loading || questionsAvailable || !revealAt) return;

        return startPisRevealPolling({
            revealAt,
            api,
            gtid,
            // Forward a question-poll request through Axios.
            get: (...args) => axios.get(...args),
            setQuestions,
            setQuestionsAvailable,
            setRevealAt,
            // Read the current timestamp for the reveal countdown.
            now: () => Date.now(),
            // Schedule the recurring reveal check.
            scheduleInterval: (callback, delay) => setInterval(callback, delay),
            // Cancel the recurring reveal check.
            clearScheduledInterval: (interval) => clearInterval(interval),
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- Setter identities did not restart the original polling timer.
    }, [loading, questionsAvailable, revealAt, api, gtid]);
}
