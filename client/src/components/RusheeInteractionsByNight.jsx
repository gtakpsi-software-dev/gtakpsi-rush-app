import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
    computeInteractionsByNight,
    formatNightInteractionLine,
} from "../js/rusheeInteractions";

export default function RusheeInteractionsByNight({
    nights: nightsProp,
    attendance,
    comments,
    className = "",
    compact = false,
}) {
    const [rushNights, setRushNights] = useState(null);

    useEffect(() => {
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
