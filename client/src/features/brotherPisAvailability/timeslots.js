// Sort timeslots in place by their BSON timestamps.
export function sortTimeslots(timeslots) {
    return timeslots.sort((a, b) => {
        // Compare timeslot timestamps in ascending order.
        const timeA = parseInt(a.time.$date.$numberLong);
        const timeB = parseInt(b.time.$date.$numberLong);
        return timeA - timeB;
    });
}

// Convert a timeslot’s BSON timestamp to an ISO date string.
export function timeslotIso(slot) {
    return new Date(parseInt(slot.time.$date.$numberLong)).toISOString();
}

// Return a set containing every timeslot’s ISO timestamp.
export function selectAllTimeslots(timeslots) {
    return new Set(timeslots.map(timeslotIso));
}

// Format a timeslot as local US date and time labels.
export function formatTimeslot(slot) {
    const date = new Date(parseInt(slot.time.$date.$numberLong));
    return {
        date: date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        }),
        time: date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        })
    };
}

// Group timeslots by their local calendar-date labels.
export function groupTimeslots(timeslots) {
    return timeslots.reduce((groups, slot) => {
        // Append each timeslot to its day’s group.
        const date = new Date(parseInt(slot.time.$date.$numberLong));
        const dateKey = date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(slot);
        return groups;
    }, {});
}
