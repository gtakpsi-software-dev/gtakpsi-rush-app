import { useEffect } from 'react';
import axios from 'axios';

import { startPisRevealPolling } from './startPisRevealPolling';

/**
 * PIS Reveal Polling Summary:
 * - Keeps the timed reveal gate and one-second polling service outside the page.
 * - Preserves the original effect dependencies and timer cleanup.
 * - Assumes revealAt remains a Date when the pending state is active.
 */
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
        if (loading || questionsAvailable || !revealAt) return;

        return startPisRevealPolling({
            revealAt,
            api,
            gtid,
            get: (...args) => axios.get(...args),
            setQuestions,
            setQuestionsAvailable,
            setRevealAt,
            now: () => Date.now(),
            scheduleInterval: (callback, delay) => setInterval(callback, delay),
            clearScheduledInterval: (interval) => clearInterval(interval),
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- Setter identities did not restart the original polling timer.
    }, [loading, questionsAvailable, revealAt, api, gtid]);
}
