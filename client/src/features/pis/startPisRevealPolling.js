import { applyPisQuestionsResponse } from "./applyPisQuestionsResponse.js";

// Poll once per second for PIS questions after their reveal time and return cleanup.
export function startPisRevealPolling({
    revealAt,
    api,
    gtid,
    get,
    setQuestions,
    setQuestionsAvailable,
    setRevealAt,
    now,
    scheduleInterval,
    clearScheduledInterval,
}) {
    // Fetch questions once the reveal countdown reaches zero.
    const tick = () => {
        // The response adapter normalizes revealAt to a Date before polling starts.
        const secondsLeft = Math.max(0, Math.round((revealAt.getTime() - now()) / 1000));

        if (secondsLeft <= 0) {
            // Retain the one-second retry cadence until a new response changes the page state.
            get(`${api}/rushee/get-pis-questions/${gtid}`).then((response) => {
                // Apply the latest question availability and reveal timing.
                applyPisQuestionsResponse(response, {
                    setQuestions, setQuestionsAvailable, setRevealAt,
                });
            });
        }
    };

    tick();
    const interval = scheduleInterval(tick, 1000);
    return /* Stop the question-reveal polling interval. */ () => clearScheduledInterval(interval);
}
