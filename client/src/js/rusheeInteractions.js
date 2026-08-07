const RUSH_TZ = "America/New_York";

const CANONICAL_RUSH_NIGHTS = [
    { name: "Night 1", time: "2026-01-28T22:00:00.000Z" },
    { name: "Night 2", time: "2026-01-29T22:00:00.000Z" },
    { name: "Closed Night", time: "2026-02-03T22:00:00.000Z" },
    { name: "Dev Night", time: "2099-12-31T22:00:00.000Z" },
];

function rushNightTime(night) {
    if (!night?.time) return null;
    const t = night.time;
    if (typeof t === "string") return t;
    if (t.$date) {
        return typeof t.$date === "string" ? t.$date : t.$date.$numberLong;
    }
    return t;
}

function namesMatch(a, b) {
    return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

function sameRushDay(timeA, timeB) {
    const a = rushNightTime({ time: timeA });
    const b = rushNightTime({ time: timeB });
    if (a == null || b == null) return false;

    const opts = { timeZone: RUSH_TZ };
    const dayA = new Date(a).toLocaleDateString("en-CA", opts);
    const dayB = new Date(b).toLocaleDateString("en-CA", opts);
    return dayA === dayB;
}

export function nightMatches(a, b) {
    if (!a || !b) return false;
    return namesMatch(a.name, b.name) || sameRushDay(a.time, b.time);
}

function isDevNight(name) {
    return (name ?? "").toLowerCase().includes("dev");
}

export function mergeRushNights(dbNights, comments) {
    const merged = [...(dbNights ?? [])];

    for (const canon of CANONICAL_RUSH_NIGHTS) {
        if (!merged.some((n) => namesMatch(n.name, canon.name))) {
            merged.push({ ...canon });
        }
    }

    for (const comment of comments ?? []) {
        const commentNight = comment.night;
        if (commentNight && !merged.some((n) => nightMatches(n, commentNight))) {
            merged.push({
                name: commentNight.name,
                time: commentNight.time ?? commentNight,
            });
        }
    }

    merged.sort((a, b) => {
        const ta = new Date(rushNightTime(a)).getTime();
        const tb = new Date(rushNightTime(b)).getTime();
        return ta - tb;
    });

    return merged;
}

export function computeInteractionsByNight(dbRushNights, attendance, comments) {
    const nights = mergeRushNights(dbRushNights, comments);

    return nights.map((night, index) => {
        const attended = (attendance ?? []).some((a) => nightMatches(a, night));

        const names = new Set();
        for (const comment of comments ?? []) {
            if (nightMatches(comment.night, night)) {
                names.add(comment.brother_name);
            }
        }
        const count = names.size;

        let interactions;
        if (isDevNight(night.name)) {
            interactions = count;
        } else if (!attended) {
            interactions = null;
        } else {
            interactions = count;
        }

        return {
            night_index: index + 1,
            name: night.name,
            interactions,
        };
    });
}

export function formatNightInteractionLine({ name, night_index, interactions }) {
    const label = name || `Night ${night_index}`;
    if (interactions === null || interactions === undefined) {
        return `${label}: N/A`;
    }
    return `${label}: Interactions: ${interactions}`;
}
