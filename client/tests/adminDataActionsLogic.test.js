import assert from "node:assert/strict";
import test from "node:test";

import { createAdminDataActions } from "../src/features/admin/data/dataActionHandlers.js";

function setup(responses = {}) {
    const calls = [];
    const actions = createAdminDataActions({
        apiBase: "/api/admin",
        getApiPrefix: () => {
            calls.push(["apiPrefix"]);
            return "/api";
        },
        axios: {
            get: async (url, config) => {
                calls.push(["get", url, config]);
                const response = responses[url];
                if (response instanceof Error) throw response;
                return { data: response ?? { status: "success", payload: [] } };
            },
            post: async (url, body) => {
                calls.push(["post", url, body]);
                const response = responses[url];
                if (response instanceof Error) throw response;
                return { data: response ?? { status: "success" } };
            },
        },
        toast: {
            success: (message, options) => calls.push(["success", message, options]),
            error: (message, options) => calls.push(["error", message, options]),
        },
        download: (content, prefix) => calls.push(["download", content, prefix]),
    });
    return { calls, actions };
}

test("generic requests retain date conversion, method arguments, and response handling", async () => {
    const { calls, actions } = setup();
    const payload = { time: "2026-09-30T16:00:00-04:00", name: "PIS" };
    await actions.handleRequest("create-timeslot", payload, "post", "Created");
    assert.deepEqual(calls[0], ["post", "/api/admin/create-timeslot", {
        time: "2026-09-30T20:00:00.000Z", name: "PIS",
    }]);
    assert.equal(payload.time, "2026-09-30T16:00:00-04:00");
    assert.equal(calls[1][1], "Created");

    const read = setup();
    await read.actions.handleRequest("get_pis_questions", {}, "get", "Check console for questions");
    assert.deepEqual(read.calls[0], ["get", "/api/admin/get_pis_questions", {}]);
    assert.equal(read.calls[1][1], "Check console for questions");

    const denied = setup({ "/api/admin/create": { status: "error", message: "Denied" } });
    await denied.actions.handleRequest("create", {});
    assert.equal(denied.calls[1][1], "Denied");
});

test("four exports keep endpoints, CSV contents, prefixes, and success messages", async () => {
    const { calls, actions } = setup({
        "/api/admin/export-rushee-info": { status: "success", payload: [{ first_name: "Ada", last_name: "Example", gtid: "123" }] },
        "/api/admin/export-rushee-numbers": { status: "success", payload: [{ rushee_number: 7, name: "Ada", gtid: "123" }] },
        "/api/rushee/get-timeslots": { status: "success", payload: [{ time: { $date: { $numberLong: "1790784000000" } }, rushee_first_name: "Ada", rushee_last_name: "Example", flex_window: false }] },
        "/api/admin/pis-availability/export-csv": { status: "success", payload: [{ timeslot: { $date: { $numberLong: "1790784000000" } }, rushee_name: "Ada Example", brother_1: "Sam", brother_2: "none none" }] },
    });
    await actions.exportRusheePersonalInfo();
    await actions.exportRusheeNumbers();
    await actions.exportPISSchedule();
    await actions.exportPISWithBrothers();

    assert.deepEqual(calls.filter(([kind]) => kind === "get").map(([, url]) => url), [
        "/api/admin/export-rushee-info", "/api/admin/export-rushee-numbers",
        "/api/rushee/get-timeslots", "/api/admin/pis-availability/export-csv",
    ]);
    assert.deepEqual(calls.filter(([kind]) => kind === "download").map(([, content, prefix]) => [prefix, content.split("\n")[0]]), [
        ["Rushee_Personal_Info", "First Name,Last Name,GTID,Email,Phone Number,Housing,Major,Class,Pronouns,Exposure"],
        ["Rushee_Numbers", "Rushee Number,Name,GTID"],
        ["PIS_Schedule", "Date,Time,Rushee Name,Flexible"],
        ["PIS_Schedule_With_Brothers", "Rushee,Date,Time,Brother 1,Brother 2"],
    ]);
    assert.deepEqual(calls.filter(([kind]) => kind === "success").map(([, message]) => message), [
        "Exported personal info for 1 rushees", "Exported 1 rushee numbers",
        "Exported 1 PIS appointments", "Exported 1 PIS appointments with brother assignments",
    ]);
});

test("failed exports preserve their distinct response and transport messages", async () => {
    const info = setup({ "/api/admin/export-rushee-info": { status: "error" } });
    await info.actions.exportRusheePersonalInfo();
    assert.equal(info.calls[1][1], "Failed to fetch rushee personal info");
    assert.ok(!info.calls.some(([kind]) => kind === "download"));

    const schedule = setup({ "/api/rushee/get-timeslots": new Error("offline") });
    await schedule.actions.exportPISSchedule();
    assert.equal(schedule.calls.at(-1)[1], "Export error: offline");

    const assigned = setup({ "/api/admin/pis-availability/export-csv": { status: "error" } });
    await assigned.actions.exportPISWithBrothers();
    assert.equal(assigned.calls[1][1], "Failed to export");
});
