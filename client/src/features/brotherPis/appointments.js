import dayjs from "dayjs";

export function sortPisAppointments(appointments) {
    return appointments.sort((a, b) => {
        const timeA = parseInt(a.pis_timeslot?.$date?.$numberLong || "0");
        const timeB = parseInt(b.pis_timeslot?.$date?.$numberLong || "0");
        return timeA - timeB;
    });
}

export function formatPisAppointmentTime(timeslot) {
    if (!timeslot?.$date?.$numberLong) return "No time scheduled";
    const timestamp = parseInt(timeslot.$date.$numberLong);
    return dayjs(timestamp).format("ddd, MMM D, YYYY [at] h:mm A");
}

export function getPisAppointmentRelativeTime(timeslot, clock = dayjs) {
    if (!timeslot?.$date?.$numberLong) return null;
    const timestamp = parseInt(timeslot.$date.$numberLong);
    const now = clock();
    const pisTime = dayjs(timestamp);

    if (pisTime.isBefore(now)) {
        return { text: "Completed", color: "text-green-600", bg: "bg-green-50" };
    }

    const diffDays = pisTime.diff(now, "day");
    const diffHours = pisTime.diff(now, "hour");

    if (diffHours < 1) {
        return { text: "Starting soon!", color: "text-red-600", bg: "bg-red-50" };
    } else if (diffHours < 24) {
        return { text: `In ${diffHours} hour${diffHours > 1 ? "s" : ""}`, color: "text-orange-600", bg: "bg-orange-50" };
    } else {
        return { text: `In ${diffDays} day${diffDays > 1 ? "s" : ""}`, color: "text-apple-gray-600", bg: "bg-apple-gray-50" };
    }
}
