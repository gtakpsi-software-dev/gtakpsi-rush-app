const RUSH_TZ = "America/New_York";

// Fall 2026 rush nights. Times are 7:00 PM ET (23:00 UTC during EDT).
const CANONICAL_RUSH_NIGHTS = [
    { name: "Night 1", time: "2026-09-09T23:00:00.000Z" },
    { name: "Night 2", time: "2026-09-10T23:00:00.000Z" },
    { name: "Closed Night", time: "2026-09-15T23:00:00.000Z" },
];

// Extract a rush-night time from plain or BSON-style values.
function rushNightTime(night) {
    if (!night?.time) return null;
    const t = night.time;
    if (typeof t === "string") return t;
    if (t.$date) {
        return typeof t.$date === "string" ? t.$date : t.$date.$numberLong;
    }
    return t;
}

// Compare night names after trimming and ignoring case.
function namesMatch(a, b) {
    return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

// Compare timestamps by calendar date in the rush timezone.
function sameRushDay(timeA, timeB) {
    const a = rushNightTime({ time: timeA });
    const b = rushNightTime({ time: timeB });
    if (a == null || b == null) return false;

    const opts = { timeZone: RUSH_TZ };
    const dayA = new Date(a).toLocaleDateString("en-CA", opts);
    const dayB = new Date(b).toLocaleDateString("en-CA", opts);
    return dayA === dayB;
}

// Match rush nights by normalized name or local calendar date.
export function nightMatches(a, b) {
    if (!a || !b) return false;
    return namesMatch(a.name, b.name) || sameRushDay(a.time, b.time);
}

// Identify development nights by the presence of dev in their name.
function isDevNight(name) {
    return (name ?? "").toLowerCase().includes("dev");
}

// Merge database, canonical, and comment-only rush nights into chronological order.
export function mergeRushNights(dbNights, comments) {
    const merged = [...(dbNights ?? [])];

    for (const canon of CANONICAL_RUSH_NIGHTS) {
        if (!merged.some(/* Check whether a canonical night’s name is already present. */ (n) => namesMatch(n.name, canon.name))) {
            merged.push({ ...canon });
        }
    }

    for (const comment of comments ?? []) {
        const commentNight = comment.night;
        if (commentNight && !merged.some(/* Check whether the comment’s night is already represented. */ (n) => nightMatches(n, commentNight))) {
            merged.push({
                name: commentNight.name,
                time: commentNight.time ?? commentNight,
            });
        }
    }

    merged.sort((a, b) => {
        // Compare rush-night timestamps chronologically.
        const ta = new Date(rushNightTime(a)).getTime();
        const tb = new Date(rushNightTime(b)).getTime();
        return ta - tb;
    });

    return merged;
}

// Count distinct commenting brothers per night, respecting attendance outside development nights.
export function computeInteractionsByNight(dbRushNights, attendance, comments) {
    const nights = mergeRushNights(dbRushNights, comments);

    return nights.map((night, index) => {
        // Build one night’s attendance-aware interaction summary.
        const attended = (attendance ?? []).some(/* Check whether attendance includes this night. */ (a) => nightMatches(a, night));

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

// Format a night’s interaction count or its unavailable label.
export function formatNightInteractionLine({ name, night_index, interactions }) {
    const label = name || `Night ${night_index}`;
    if (interactions === null || interactions === undefined) {
        return `${label}: N/A`;
    }
    return `${label}: Interactions: ${interactions}`;
}
