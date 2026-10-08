// Format a BSON timeslot as a local US date and time label.
export function formatTimeslot(timeslot) {
    const dateNum = parseInt(timeslot.time.$date.$numberLong);
    const date = new Date(dateNum);
    return date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

// Format a rushee’s current PIS time or return the unscheduled fallback.
export function formatCurrentPISTime(rushee) {
    if (!rushee.pis_timeslot) return "Not scheduled";
    try {
        const dateNum = parseInt(rushee.pis_timeslot.$date.$numberLong);
        const date = new Date(dateNum);
        return date.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } catch {
        return "Not scheduled";
    }
}

// Return separate local US date and time labels for a timeslot.
export function formatSlotTime(slot) {
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

// Group PIS timeslots by their local calendar-date labels.
export function groupEditSlots(allPisTimeslots) {
    return allPisTimeslots.reduce((groups, slot) => {
        // Append a timeslot to its day’s availability group.
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
