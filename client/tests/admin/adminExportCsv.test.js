import assert from "node:assert/strict";
import test from "node:test";

import {
    buildRusheePersonalInfoCsv,
    buildRusheeNumbersCsv,
    buildPisScheduleCsv,
    buildPisScheduleWithBrothersCsv,
} from "../../src/features/admin/data/exportCsv.js";

test("personal-info CSV preserves field order and the existing per-field quoting", () => {
    const rushees = [{
        first_name: 'Ada "A"', last_name: "Lovelace", gtid: "9", email: "ada@example.com",
        phone_number: "123", housing: 'North "Hall"', major: "CS, Math", class: "2027",
        pronouns: "she/her", exposure: "event",
    }, {}];

    assert.equal(buildRusheePersonalInfoCsv(rushees), [
        "First Name,Last Name,GTID,Email,Phone Number,Housing,Major,Class,Pronouns,Exposure",
        '"Ada ""A""","Lovelace","9","ada@example.com","123","North ""Hall""","CS, Math","2027","she/her","event"',
        '"","","","","","","","","",""',
    ].join("\n"));
});

test("rushee-number CSV retains mapping order and legacy quote handling", () => {
    assert.equal(buildRusheeNumbersCsv([
        { rushee_number: "001", name: 'A "Quoted" Name', gtid: "9" },
        { rushee_number: "002", name: "Bob", gtid: "10" },
    ]), [
        "Rushee Number,Name,GTID",
        '"001","A "Quoted" Name","9"',
        '"002","Bob","10"',
    ].join("\n"));
});

test("PIS schedule CSV sorts appointments by date and retains flexible labels", () => {
    const first = Date.parse("2026-10-01T12:00:00Z");
    const second = Date.parse("2026-10-02T14:30:00Z");
    const slots = [
        { time: { $date: { $numberLong: String(second) } }, rushee_first_name: "Bob", rushee_last_name: "B", flex_window: false },
        { time: { $date: { $numberLong: String(first) } }, rushee_first_name: "Ada", rushee_last_name: "A", flex_window: true },
    ];
    const row = (timestamp, name, flexible) => {
        const date = new Date(timestamp);
        return [`"${date.toLocaleDateString()}"`, `"${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}"`, `"${name}"`, `"${flexible}"`].join(",");
    };

    assert.equal(buildPisScheduleCsv(slots), [
        "Date,Time,Rushee Name,Flexible",
        row(first, "Ada A", "Yes"),
        row(second, "Bob B", "No"),
    ].join("\n"));
    assert.equal(slots[0].rushee_first_name, "Bob");
});

test("full PIS schedule CSV supports both date forms and blank brother sentinels", () => {
    const first = Date.parse("2026-10-01T12:00:00Z");
    const second = Date.parse("2026-10-02T14:30:00Z");
    const assignments = [
        { timeslot: new Date(second).toISOString(), rushee_name: "Bob B", brother_1: "Brother One", brother_2: "none none" },
        { timeslot: { $date: { $numberLong: String(first) } }, rushee_name: "Ada A", brother_1: "none none", brother_2: "Brother Two" },
    ];
    const row = (timestamp, name, firstBrother, secondBrother) => {
        const date = new Date(timestamp);
        return [`"${name}"`, `"${date.toLocaleDateString()}"`, `"${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}"`, `"${firstBrother}"`, `"${secondBrother}"`].join(",");
    };

    assert.equal(buildPisScheduleWithBrothersCsv(assignments), [
        "Rushee,Date,Time,Brother 1,Brother 2",
        row(first, "Ada A", "", "Brother Two"),
        row(second, "Bob B", "Brother One", ""),
    ].join("\n"));
    assert.equal(assignments[0].rushee_name, "Bob B");
});
