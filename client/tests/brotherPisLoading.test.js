import assert from "node:assert/strict";
import test from "node:test";

import { loadBrotherPisSlots } from "../src/features/brotherPis/loadBrotherPisSlots.js";

const ERROR_ROUTE = "/error/Uh Oh! Something weird happened.../Some network error happened while submitting your comment...";

function slot(time, gtid) {
    return {
        time: { $date: { $numberLong: String(Date.parse(time)) } },
        rushee_first_name: "Ada",
        rushee_last_name: "Lovelace",
        rushee_gtid: gtid,
        first_brother_first_name: "Grace",
        first_brother_last_name: "Hopper",
        second_brother_first_name: "none",
        second_brother_last_name: "none",
    };
}

function harness(overrides = {}) {
    const calls = [];
    const maps = [];
    const payload = [
        slot("2030-01-01T19:00:00Z", "second"),
        slot("2030-01-01T17:00:00Z", "first"),
        slot("2030-01-02T18:00:00Z", "third"),
    ];
    const dependencies = {
        verifyUser: async () => { calls.push(["verify"]); return true; },
        navigate: path => calls.push(["navigate", path]),
        axios: {
            get: async url => { calls.push(["get", url]); return { data: { status: "success", payload } }; },
        },
        api: "/api",
        setDays: map => { calls.push(["days", map.size]); maps.push(map); },
        setLoading: value => calls.push(["loading", value]),
        logPayload: value => calls.push(["log", value]),
        ...overrides,
    };
    return { calls, maps, payload, dependencies };
}

test("PIS slots keep fetch order, per-entry updates, and chronological grouping", async () => {
    const { calls, maps, payload, dependencies } = harness();
    await loadBrotherPisSlots(dependencies);

    assert.deepEqual(calls.map(([kind]) => kind), [
        "loading", "verify", "get", "log", "days", "days", "days", "loading",
    ]);
    assert.deepEqual(calls.filter(([kind]) => kind === "loading"), [["loading", true], ["loading", false]]);
    assert.equal(calls[2][1], "/api/rushee/get-timeslots");
    assert.equal(calls[3][1], payload);
    assert.deepEqual(calls.filter(([kind]) => kind === "days").map(([, count]) => count), [1, 1, 2]);
    assert.equal(maps[0], maps[1]);
    assert.equal(maps[1], maps[2]);
    const firstDay = new Date("2030-01-01T19:00:00Z").toDateString();
    assert.deepEqual(maps[2].get(firstDay).map(({ rushee_gtid }) => rushee_gtid), ["first", "second"]);
    assert.equal(maps[2].get(firstDay)[0].first_brother_first_name, "Grace");
});

test("a false verification result still navigates and fetches before loading ends", async () => {
    const { calls, dependencies } = harness({ verifyUser: async () => false });
    await loadBrotherPisSlots(dependencies);
    assert.deepEqual(calls.slice(0, 4).map(([kind]) => kind), ["loading", "navigate", "get", "log"]);
    assert.deepEqual(calls[1], ["navigate", "/"]);
    assert.deepEqual(calls.at(-1), ["loading", false]);
});

test("empty success and unsuccessful responses retain distinct state effects", async () => {
    const empty = harness({ axios: { get: async () => ({ data: { status: "success", payload: [] } }) } });
    await loadBrotherPisSlots(empty.dependencies);
    assert.deepEqual(empty.calls.map(([kind]) => kind), ["loading", "verify", "log", "loading"]);
    assert.equal(empty.maps.length, 0);

    const unsuccessful = harness({ axios: { get: async () => ({ data: { status: "error" } }) } });
    await loadBrotherPisSlots(unsuccessful.dependencies);
    assert.deepEqual(unsuccessful.calls, [
        ["loading", true], ["verify"], ["navigate", ERROR_ROUTE], ["loading", false],
    ]);
});

test("verification and request rejections use the same existing error route", async () => {
    for (const overrides of [
        { verifyUser: async () => { throw new Error("invalid"); } },
        { axios: { get: async () => { throw new Error("offline"); } } },
    ]) {
        const { calls, dependencies } = harness(overrides);
        await loadBrotherPisSlots(dependencies);
        assert.deepEqual(calls.filter(([kind]) => kind === "navigate"), [["navigate", ERROR_ROUTE]]);
        assert.deepEqual(calls.at(-1), ["loading", false]);
    }
});
