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

export default function RusheeInteractionsByNight({
    nights: nightsProp,
    attendance,
    comments,
    className = "",
    compact = false,
}: RusheeInteractionsByNightProps) {
    const [rushNights, setRushNights] = useState<object[] | null>(null);

    useEffect(() => {
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
                if (res.data.status === "success") {
                    setRushNights(res.data.payload);
                }
            })
            .catch(() => {});
    }, [nightsProp, attendance, comments]);

    const nights = useMemo(() => {
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
            {nights.map((night) => (
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
