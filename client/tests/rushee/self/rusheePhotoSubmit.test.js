import assert from "node:assert/strict";
import test from "node:test";

import { submitRusheePhoto } from "../../../src/features/rushee/self/submitRusheePhoto.js";

const toastOptions = {
    position: "top-center", autoClose: 5000, hideProgressBar: false,
    closeOnClick: true, pauseOnHover: true, draggable: true,
    progress: undefined, theme: "dark",
};

function harness(overrides = {}) {
    const events = [];
    const storage = { name: "storage" };
    const storageRef = { path: "photo" };
    const blob = { type: "image/jpeg" };
    const deps = {
        image: "data:image/jpeg;base64,AAA",
        gtid: "123456789",
        api: "/api",
        storage,
        now: () => 12345,
        setLoading: (value) => events.push(["loading", value]),
        makeStorageRef: (client, path) => { events.push(["ref", client, path]); return storageRef; },
        toBlob: (image) => { events.push(["blob", image]); return blob; },
        upload: async (target, value) => { events.push(["upload", target, value]); },
        getDownloadUrl: async (target) => { events.push(["download", target]); return "https://files.example/photo"; },
        post: async (path, payload) => {
            events.push(["post", path, payload]);
            return { data: { status: "success" } };
        },
        toast: { error: (message, options) => events.push(["error", message, options]) },
        reload: () => events.push(["reload"]),
        navigate: (path) => events.push(["navigate", path]),
        logger: { error: (message, error) => events.push(["log", message, error]) },
        ...overrides,
    };
    return { deps, events, storage, storageRef, blob };
}

test("photo upload keeps the timestamp path, Storage URL, update payload, and reload order", async () => {
    const { deps, events, storage, storageRef, blob } = harness();
    await submitRusheePhoto(deps);
    assert.deepEqual(events, [
        ["loading", true],
        ["ref", storage, "profile-pictures/123456789_12345.jpg"],
        ["blob", "data:image/jpeg;base64,AAA"],
        ["upload", storageRef, blob],
        ["download", storageRef],
        ["post", "/api/rushee/update-rushee/123456789", [
            { field: "image_url", new_value: "https://files.example/photo" },
        ]],
        ["reload"], ["loading", false],
    ]);
});

test("unsuccessful update reports its message and clears loading without reload", async () => {
    const { deps, events } = harness({
        post: async (path, payload) => {
            events.push(["post", path, payload]);
            return { data: { status: "error", message: "Photo rejected" } };
        },
    });
    await submitRusheePhoto(deps);
    assert.deepEqual(events.slice(-2), [
        ["error", "Photo rejected", toastOptions], ["loading", false],
    ]);
    assert.equal(events.some(([type]) => type === "reload"), false);
});

test("update request failures use the network toast and still clear loading", async () => {
    const { deps, events } = harness({ post: async () => { throw new Error("offline"); } });
    await submitRusheePhoto(deps);
    assert.deepEqual(events.slice(-2), [
        ["error", "Some internal network error occurred", toastOptions],
        ["loading", false],
    ]);
    assert.equal(events.some(([type]) => type === "navigate"), false);
});

test("reload exceptions follow the existing inner network-error catch", async () => {
    const { deps, events } = harness({ reload: () => { throw new Error("reload failed"); } });
    await submitRusheePhoto(deps);
    assert.deepEqual(events.slice(-2), [
        ["error", "Some internal network error occurred", toastOptions],
        ["loading", false],
    ]);
});

test("conversion, upload, and URL failures log and navigate without clearing loading", async () => {
    const failed = new Error("storage failed");
    for (const override of [
        { toBlob: () => { throw failed; } },
        { upload: async () => { throw failed; } },
        { getDownloadUrl: async () => { throw failed; } },
    ]) {
        const { deps, events } = harness(override);
        await submitRusheePhoto(deps);
        assert.deepEqual(events.slice(-2), [
            ["log", "Error uploading image:", failed],
            ["navigate", "/error/Uh Oh! Something Unexpected Occurred../There was an error uploading your image to the cloud."],
        ]);
        assert.equal(events.some(([type]) => type === "post"), false);
        assert.equal(events.some(([type, value]) => type === "loading" && value === false), false);
    }
});
