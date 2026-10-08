import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
    computeInteractionsByNight,
    formatNightInteractionLine,
} from "../features/rushee/interactions";
import type { NightInteractionSummary } from "../features/rushee/interactions.types";

type RusheeInteractionsByNightProps = {
    nights?: NightInteractionSummary[];
    attendance?: unknown[];
    comments?: unknown[];
    className?: string;
    compact?: boolean;
};

// Display per-night interaction summaries, deriving them when precomputed values are absent.
export default function RusheeInteractionsByNight({
    nights: nightsProp,
    attendance,
    comments,
    className = "",
    compact = false,
}: RusheeInteractionsByNightProps) {
    const [rushNights, setRushNights] = useState<object[] | null>(null);

    useEffect(() => {
        // Fetch rush nights only when local attendance or comments need derived summaries.
        // Precomputed summaries avoid a second rush-night request on list cards.
        if (nightsProp?.length) {
            return;
        }
        if (!attendance && !comments?.length) {
            return;
        }

        const api = import.meta.env.VITE_API_PREFIX;
        axios
            .get(`${api}/rushee/rush-nights`)
            .then((res) => {
                // Store the schedule from a successful rush-night response.
                if (res.data.status === "success") {
                    setRushNights(res.data.payload);
                }
            })
            .catch(/* Leave summaries unchanged if the schedule request fails. */ () => {});
    }, [nightsProp, attendance, comments]);

    const nights = useMemo(() => {
        // Choose supplied summaries or derive them from the loaded schedule.
        if (nightsProp?.length) {
            return nightsProp;
        }
        if (rushNights && (attendance || comments?.length)) {
            return computeInteractionsByNight(rushNights, attendance, comments);
        }
        return [];
    }, [nightsProp, rushNights, attendance, comments]);

    if (!nights.length) {
        return null;
    }

    return (
        <div className={`space-y-0.5 ${className}`.trim()}>
            {nights.map(/* Render one formatted interaction summary for a rush night. */ (night) => (
                <p
                    key={`${night.name}-${night.night_index}`}
                    className={
                        compact
                            ? "text-apple-caption1 text-apple-gray-600 font-light"
                            : "text-apple-footnote text-apple-gray-600 font-light"
                    }
                >
                    {formatNightInteractionLine(night)}
                </p>
            ))}
        </div>
    );
}
