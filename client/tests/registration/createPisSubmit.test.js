import assert from "node:assert/strict";
import test from "node:test";

import { createPisSubmit } from "../../src/features/registration/createPisSubmit.js";

function harness(overrides = {}) {
    const events = [];
    const storage = {};
    const storageRef = {};
    const blob = {};
    const form = {
        firstName: "Ada", lastName: "Lovelace", housing: "Hall",
        phone: "4045550100", email: "ada@example.invalid", gtid: "900000001",
        major: "Business", year: "Third Year", pronouns: "she/her",
        exposure: "Friend", selectedSlot: { time: "2030-01-01T18:00:00Z" },
        flexWindow: false, image: "data:image/jpeg;base64,abc",
    };
    const deps = {
        api: "/api",
        form,
        pageError: null,
        errorTitle: "Original title",
        errorDescription: "Original description",
        storage,
        ref(receivedStorage, path) {
            events.push(["ref", receivedStorage, path]);
            return storageRef;
        },
        base64ToBlob(image) {
            events.push(["blob", image]);
            return blob;
        },
        async uploadBytes(...args) { events.push(["upload", ...args]); },
        async getDownloadURL(ref) {
            events.push(["url", ref]);
            return "https://example.invalid/headshot.jpg";
        },
        async post(...args) {
            events.push(["post", ...args]);
            return { data: { status: "success", payload: "access-code" } };
        },
        navigate: (path) => events.push(["navigate", path]),
        setCurrLoading: (value) => events.push(["loading", value]),
        setPage: (value) => events.push(["page", value]),
        setErrorTitle: (value) => events.push(["errorTitle", value]),
        setErrorDescription: (value) => events.push(["errorDescription", value]),
        setAccessCode: (value) => events.push(["accessCode", value]),
        setError: (value) => events.push(["error", value]),
        logError: (error) => events.push(["log", error]),
        ...overrides,
    };
    return { events, deps, storage, storageRef, blob, form };
}

test("PIS submission uploads the image before posting the existing signup payload", async () => {
    const { events, deps, storage, storageRef, blob, form } = harness();
    await createPisSubmit(deps)();

    assert.deepEqual(events.map(([kind]) => kind), [
        "loading", "page", "ref", "blob", "upload", "url",
        "post", "accessCode", "loading", "error",
    ]);
    assert.deepEqual(events.slice(0, 6), [
        ["loading", true], ["page", 3],
        ["ref", storage, "profile-pictures/900000001.jpg"],
        ["blob", form.image], ["upload", storageRef, blob], ["url", storageRef],
    ]);
    assert.deepEqual(events[6], ["post", "/api/rushee/signup", {
        first_name: "Ada", last_name: "Lovelace", housing: "Hall",
        phone_number: "4045550100", email: "ada@example.invalid", gtid: "900000001",
        major: "Business", class: "Third Year", pronouns: "she/her",
        image_url: "https://example.invalid/headshot.jpg", exposure: "Friend",
        pis_meeting_id: "meeting123", pis_timeslot: "2030-01-01T18:00:00Z",
        pis_link: "https://example.com/pis_meeting", flex_window: false,
    }]);
    assert.deepEqual(events.slice(-3), [
        ["accessCode", "access-code"], ["loading", false], ["error", false],
    ]);
});

test("image upload failure navigates with the captured title and leaves loading set", async () => {
    const failure = new Error("upload failed");
    const { events, deps } = harness({ uploadBytes: async () => { throw failure; } });
    await createPisSubmit(deps)();
    assert.deepEqual(events.map(([kind]) => kind), [
        "loading", "page", "ref", "blob", "log", "errorTitle",
        "errorDescription", "navigate",
    ]);
    assert.deepEqual(events.slice(-4), [
        ["log", failure],
        ["errorTitle", "Uh Oh! Something Unexpected Occurred.."],
        ["errorDescription", "There was an error uploading your image to the cloud."],
        ["navigate", "/error/Original title/There was an error uploading your image to the cloud."],
    ]);
});

test("error and unrecognized API statuses navigate before clearing loading", async () => {
    for (const status of ["error", "other"]) {
        const { events, deps } = harness({
            post: async () => ({ data: { status } }),
        });
        await createPisSubmit(deps)();
        assert.deepEqual(events.slice(-3), [
            ["navigate", "/error/Original title/Original description"],
            ["loading", false], ["error", false],
        ]);
    }
});

test("API rejection logs the captured page error and still clears loading", async () => {
    const { events, deps } = harness({
        pageError: "prior-error",
        post: async () => { throw new Error("offline"); },
    });
    await createPisSubmit(deps)();
    assert.deepEqual(events.slice(-4), [
        ["log", "prior-error"],
        ["navigate", "/error/Original title/Original description"],
        ["loading", false], ["error", false],
    ]);
});

test("missing selected slot throws after upload without completing submission", async () => {
    const { events, deps } = harness({ form: { ...harness().form, selectedSlot: null } });
    await assert.rejects(createPisSubmit(deps)(), TypeError);
    assert.deepEqual(events.map(([kind]) => kind), [
        "loading", "page", "ref", "blob", "upload", "url",
    ]);
});

test("request-start and success-callback failures retain distinct catch behavior", async () => {
    const requestError = new Error("request setup failed");
    const synchronous = harness({
        post: () => { throw requestError; },
    });
    await createPisSubmit(synchronous.deps)();
    assert.deepEqual(synchronous.events.slice(-4), [
        ["log", requestError],
        ["navigate", "/error/Original title/Original description"],
        ["loading", false], ["error", false],
    ]);

    const callback = harness({
        pageError: "captured-error",
        setAccessCode: () => { throw new Error("setter failed"); },
    });
    await createPisSubmit(callback.deps)();
    assert.deepEqual(callback.events.slice(-4), [
        ["log", "captured-error"],
        ["navigate", "/error/Original title/Original description"],
        ["loading", false], ["error", false],
    ]);
});
