import assert from "node:assert/strict";
import test from "node:test";
import dayjs from "dayjs";

import {
    sortPisAppointments,
    formatPisAppointmentTime,
    getPisAppointmentRelativeTime,
} from "../src/features/brotherPis/appointments.js";

const slot = (milliseconds) => ({ $date: { $numberLong: String(milliseconds) } });

test("appointments sort in place by stored timestamp, with missing times first", () => {
    const appointments = [
        { id: "late", pis_timeslot: slot(2000) },
        { id: "missing" },
        { id: "early", pis_timeslot: slot(1000) },
        { id: "equal", pis_timeslot: slot(1000) },
    ];

    assert.equal(sortPisAppointments(appointments), appointments);
    assert.deepEqual(appointments.map(({ id }) => id), ["missing", "early", "equal", "late"]);
});

test("appointment time keeps the missing label and local display format", () => {
    assert.equal(formatPisAppointmentTime(null), "No time scheduled");
    assert.equal(formatPisAppointmentTime({ $date: {} }), "No time scheduled");

    assert.notEqual(formatPisAppointmentTime(slot(0)), "No time scheduled");
    const formatted = formatPisAppointmentTime(slot(129600000));
    assert.match(formatted, /^\w{3}, \w{3} \d{1,2}, 1970 at \d{1,2}:\d{2} [AP]M$/);
});

test("relative labels retain completed, soon, hourly, and daily boundaries", () => {
    const now = dayjs("2030-01-01T12:00:00");
    const clock = () => now;
    const relative = (minutes) => getPisAppointmentRelativeTime(
        slot(now.add(minutes, "minute").valueOf()), clock,
    );

    assert.equal(getPisAppointmentRelativeTime(null, clock), null);
    assert.deepEqual(relative(-1), {
        text: "Completed", color: "text-green-600", bg: "bg-green-50",
    });
    assert.deepEqual(relative(0), {
        text: "Starting soon!", color: "text-red-600", bg: "bg-red-50",
    });
    assert.deepEqual(relative(59), {
        text: "Starting soon!", color: "text-red-600", bg: "bg-red-50",
    });
    assert.deepEqual(relative(60), {
        text: "In 1 hour", color: "text-orange-600", bg: "bg-orange-50",
    });
    assert.deepEqual(relative(120), {
        text: "In 2 hours", color: "text-orange-600", bg: "bg-orange-50",
    });
    assert.deepEqual(relative(1440), {
        text: "In 1 day", color: "text-apple-gray-600", bg: "bg-apple-gray-50",
    });
    assert.deepEqual(relative(2880), {
        text: "In 2 days", color: "text-apple-gray-600", bg: "bg-apple-gray-50",
    });
});
