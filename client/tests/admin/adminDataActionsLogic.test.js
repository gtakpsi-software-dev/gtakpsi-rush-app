import assert from "node:assert/strict";
import test from "node:test";

import { createAdminDataActions } from "../../src/features/admin/data/dataActionHandlers.js";

// Create isolated state, dependency fakes, and captured calls for this test.
function setup(responses = {}, { prefixError, downloadError } = {}) {
    const calls = [];
    const actions = createAdminDataActions({
        apiBase: "/api/admin",
        // Record prefix lookup and optionally throw the configured error.
        getApiPrefix: () => {
            calls.push(["apiPrefix"]);
            if (prefixError) throw prefixError;
            return "/api";
        },
        axios: {
            // Record the GET request and select its response by URL.
            get: async (url, config) => {
                calls.push(["get", url, config]);
                const response = responses[url];
                if (response instanceof Error) throw response;
                return { data: response ?? { status: "success", payload: [] } };
            },
            // Record the POST request and select its response by URL.
            post: async (url, body) => {
                calls.push(["post", url, body]);
                const response = responses[url];
                if (response instanceof Error) throw response;
                return { data: response ?? { status: "success" } };
            },
        },
        toast: {
            // Record success calls for assertions.
            success: (message, options) => calls.push(["success", message, options]),
            // Record error calls for assertions.
            error: (message, options) => calls.push(["error", message, options]),
        },
        // Record download contents and optionally simulate download failure.
        download: (content, prefix) => {
            calls.push(["download", content, prefix]);
            if (downloadError) throw downloadError;
        },
    });
    return { calls, actions };
}

test("generic requests retain date conversion, method arguments, and response handling", async () => {
    // Verify generic requests retain date conversion, method arguments, and response handling.
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
    // Verify four exports keep endpoints, CSV contents, prefixes, and success messages.
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

    assert.deepEqual(calls.filter(
        /* Select recorded get calls. */
        ([kind]) => kind === "get").map(
        /* Return url to the caller. */
        ([, url]) => url), [
        "/api/admin/export-rushee-info", "/api/admin/export-rushee-numbers",
        "/api/rushee/get-timeslots", "/api/admin/pis-availability/export-csv",
    ]);
    assert.deepEqual(calls.filter(
        /* Select recorded download calls. */
        ([kind]) => kind === "download").map(
        /* Return the fixture for this scenario. */
        ([, content, prefix]) => [prefix, content.split("\n")[0]]), [
        ["Rushee_Personal_Info", "First Name,Last Name,GTID,Email,Phone Number,Housing,Major,Class,Pronouns,Exposure"],
        ["Rushee_Numbers", "Rushee Number,Name,GTID"],
        ["PIS_Schedule", "Date,Time,Rushee Name,Flexible"],
        ["PIS_Schedule_With_Brothers", "Rushee,Date,Time,Brother 1,Brother 2"],
    ]);
    assert.deepEqual(calls.filter(
        /* Select recorded success calls. */
        ([kind]) => kind === "success").map(
        /* Return message to the caller. */
        ([, message]) => message), [
        "Exported personal info for 1 rushees", "Exported 1 rushee numbers",
        "Exported 1 PIS appointments", "Exported 1 PIS appointments with brother assignments",
    ]);
});

test("failed exports preserve their distinct response and transport messages", async () => {
    // Verify failed exports preserve their distinct response and transport messages.
    const info = setup({ "/api/admin/export-rushee-info": { status: "error" } });
    await info.actions.exportRusheePersonalInfo();
    assert.equal(info.calls[1][1], "Failed to fetch rushee personal info");
    assert.ok(!info.calls.some(/* Select recorded download calls. */ ([kind]) => kind === "download"));

    const schedule = setup({ "/api/rushee/get-timeslots": new Error("offline") });
    await schedule.actions.exportPISSchedule();
    assert.equal(schedule.calls.at(-1)[1], "Export error: offline");

    const assigned = setup({ "/api/admin/pis-availability/export-csv": { status: "error" } });
    await assigned.actions.exportPISWithBrothers();
    assert.equal(assigned.calls[1][1], "Failed to export");
});

test("export setup and download errors use the existing generic error toast", async () => {
    // Verify export setup and download errors use the existing generic error toast.
    const prefix = setup({}, { prefixError: new Error("missing API prefix") });
    await prefix.actions.exportPISSchedule();
    assert.deepEqual(prefix.calls.map(/* Return kind to the caller. */ ([kind]) => kind), ["apiPrefix", "error"]);
    assert.equal(prefix.calls.at(-1)[1], "Export error: missing API prefix");

    const downloadFailure = setup({}, { downloadError: new Error("save failed") });
    await downloadFailure.actions.exportRusheeNumbers();
    assert.deepEqual(downloadFailure.calls.map(/* Return kind to the caller. */ ([kind]) => kind), ["get", "download", "error"]);
    assert.equal(downloadFailure.calls.at(-1)[1], "Export error: save failed");
});
