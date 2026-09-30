import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";

import {
    formatCurrentPISTime,
    formatSlotTime,
    formatTimeslot,
    groupEditSlots,
} from "../src/features/admin/pis/pisTime.js";

const slot = { time: { $date: { $numberLong: "1790784000000" } } };
const nextDay = { time: { $date: { $numberLong: "1790870400000" } } };

test("PIS times retain their existing labels and unscheduled fallback", () => {
    process.env.TZ = "America/New_York";

    assert.equal(formatTimeslot(slot), "Wed, Sep 30, 12:00 PM");
    assert.equal(formatCurrentPISTime({ pis_timeslot: slot.time }), "Wed, Sep 30, 12:00 PM");
    assert.equal(formatCurrentPISTime({}), "Not scheduled");
    assert.equal(formatCurrentPISTime({ pis_timeslot: {} }), "Not scheduled");
    assert.deepEqual(formatSlotTime(slot), { date: "Wed, Sep 30", time: "12:00 PM" });
});

test("availability groups retain date order and original slot objects", () => {
    process.env.TZ = "America/New_York";

    assert.deepEqual(groupEditSlots([]), {});
    assert.deepEqual(groupEditSlots([slot, nextDay, slot]), {
        "Wednesday, September 30": [slot, slot],
        "Thursday, October 1": [nextDay],
    });
});
