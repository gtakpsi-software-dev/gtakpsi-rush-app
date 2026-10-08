import assert from "node:assert/strict";
import test from "node:test";

import { createPisSubmit } from "../../src/features/registration/createPisSubmit.js";

// Create isolated state, dependency fakes, and captured calls for this test.
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
        // Record storage path lookup and return the storage fixture.
        ref(receivedStorage, path) {
            events.push(["ref", receivedStorage, path]);
            return storageRef;
        },
        // Record image conversion and return the blob fixture.
        base64ToBlob(image) {
            events.push(["blob", image]);
            return blob;
        },
        // Record upload bytes calls for assertions.
        async uploadBytes(...args) { events.push(["upload", ...args]); },
        // Record download URL lookup and return the headshot URL fixture.
        async getDownloadURL(ref) {
            events.push(["url", ref]);
            return "https://example.invalid/headshot.jpg";
        },
        // Record registration submission and return the access-code fixture.
        async post(...args) {
            events.push(["post", ...args]);
            return { data: { status: "success", payload: "access-code" } };
        },
        // Record navigate calls for assertions.
        navigate: (path) => events.push(["navigate", path]),
        // Record set curr loading calls for assertions.
        setCurrLoading: (value) => events.push(["loading", value]),
        // Record set page calls for assertions.
        setPage: (value) => events.push(["page", value]),
        // Record set error title calls for assertions.
        setErrorTitle: (value) => events.push(["errorTitle", value]),
        // Record set error description calls for assertions.
        setErrorDescription: (value) => events.push(["errorDescription", value]),
        // Record set access code calls for assertions.
        setAccessCode: (value) => events.push(["accessCode", value]),
        // Record set error calls for assertions.
        setError: (value) => events.push(["error", value]),
        // Record log error calls for assertions.
        logError: (error) => events.push(["log", error]),
        ...overrides,
    };
    return { events, deps, storage, storageRef, blob, form };
}

test("PIS submission uploads the image before posting the existing signup payload", async () => {
    // Verify PIS submission uploads the image before posting the existing signup payload.
    const { events, deps, storage, storageRef, blob, form } = harness();
    await createPisSubmit(deps)();

    assert.deepEqual(events.map(/* Return kind to the caller. */ ([kind]) => kind), [
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
    // Verify image upload failure navigates with the captured title and leaves loading set.
    const failure = new Error("upload failed");
    const { events, deps } = harness({ uploadBytes: async () => {
        // Simulate a dependency failure for this scenario.
         throw failure; } });
    await createPisSubmit(deps)();
    assert.deepEqual(events.map(/* Return kind to the caller. */ ([kind]) => kind), [
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
    // Verify error and unrecognized API statuses navigate before clearing loading.
    for (const status of ["error", "other"]) {
        const { events, deps } = harness({
            // Return the post fixture for this scenario.
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
    // Verify API rejection logs the captured page error and still clears loading.
    const { events, deps } = harness({
        pageError: "prior-error",
        // Simulate a dependency failure for this scenario.
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
    // Verify missing selected slot throws after upload without completing submission.
    const { events, deps } = harness({ form: { ...harness().form, selectedSlot: null } });
    await assert.rejects(createPisSubmit(deps)(), TypeError);
    assert.deepEqual(events.map(/* Return kind to the caller. */ ([kind]) => kind), [
        "loading", "page", "ref", "blob", "upload", "url",
    ]);
});

test("request-start and success-callback failures retain distinct catch behavior", async () => {
    // Verify request-start and success-callback failures retain distinct catch behavior.
    const requestError = new Error("request setup failed");
    const synchronous = harness({
        // Simulate a dependency failure for this scenario.
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
        // Simulate a dependency failure for this scenario.
        setAccessCode: () => { throw new Error("setter failed"); },
    });
    await createPisSubmit(callback.deps)();
    assert.deepEqual(callback.events.slice(-4), [
        ["log", "captured-error"],
        ["navigate", "/error/Original title/Original description"],
        ["loading", false], ["error", false],
    ]);
});
