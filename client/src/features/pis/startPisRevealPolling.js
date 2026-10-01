import { applyPisQuestionsResponse } from "./applyPisQuestionsResponse.js";

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
    const tick = () => {
        const secondsLeft = Math.max(0, Math.round((revealAt.getTime() - now()) / 1000));

        if (secondsLeft <= 0) {
            // Retain the one-second retry cadence until a new response changes the page state.
            get(`${api}/rushee/get-pis-questions/${gtid}`).then((response) => {
                applyPisQuestionsResponse(response, {
                    setQuestions, setQuestionsAvailable, setRevealAt,
                });
            });
        }
    };

    tick();
    const interval = scheduleInterval(tick, 1000);
    return () => clearScheduledInterval(interval);
}
