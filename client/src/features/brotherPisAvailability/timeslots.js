export function sortTimeslots(timeslots) {
    return timeslots.sort((a, b) => {
        const timeA = parseInt(a.time.$date.$numberLong);
        const timeB = parseInt(b.time.$date.$numberLong);
        return timeA - timeB;
    });
}

export function timeslotIso(slot) {
    return new Date(parseInt(slot.time.$date.$numberLong)).toISOString();
}

export function selectAllTimeslots(timeslots) {
    return new Set(timeslots.map(timeslotIso));
}

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

export function groupTimeslots(timeslots) {
    return timeslots.reduce((groups, slot) => {
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
