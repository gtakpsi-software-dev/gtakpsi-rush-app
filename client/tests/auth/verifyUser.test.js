import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { transformWithEsbuild } from "vite";

const sourcePath = fileURLToPath(new URL("../../src/features/auth/verifyUser.js", import.meta.url));

async function harness({
    user = null,
    apiKey,
    claims = { admin: true, bidcom: false },
    access = { status: "success", allowed: true },
    accessError,
    tokenError,
} = {}) {
    const source = (await readFile(sourcePath, "utf8"))
        .replace("const api = import.meta.env.VITE_API_PREFIX;", 'const api = "/api";')
        .replace("import.meta.env.VITE_API_KEY", JSON.stringify(apiKey));
    const compiled = await transformWithEsbuild(source, sourcePath, { format: "cjs" });
    const module = { exports: {} };
    const events = [];
    const auth = {
        onAuthStateChanged(callback) {
            queueMicrotask(() => callback(user && {
                uid: "uid-1",
                email: "member@example.invalid",
                displayName: "Ada Grace Lovelace",
                ...user,
                async getIdTokenResult(forceRefresh) {
                    events.push(["token", forceRefresh]);
                    if (tokenError) throw tokenError;
                    return { claims };
                },
            }));
            return () => events.push(["unsubscribe"]);
        },
    };
    const storage = {
        setItem(key, value) { events.push(["store", key, value]); },
        removeItem(key) { events.push(["remove", key]); },
    };

    runInNewContext(compiled.code, {
        module,
        exports: module.exports,
        localStorage: storage,
        console: { warn: (...args) => events.push(["warn", ...args]) },
        fetch: async (url, options) => {
            events.push(["fetch", url, options]);
            if (accessError) throw accessError;
            return { json: async () => access };
        },
        require(specifier) {
            if (specifier === "react-toastify") return {
                toast: { error: (...args) => events.push(["toast", ...args]) },
            };
            if (specifier === "../../firebase") return {
                auth,
                signOut: async (target) => events.push(["signOut", target === auth]),
            };
            throw new Error(`Unexpected import: ${specifier}`);
        },
    }, { filename: sourcePath });

    return { verifyUser: module.exports.verifyUser, events };
}

test("missing Firebase user removes the stored identity without an access request", async () => {
    const { verifyUser, events } = await harness();
    assert.equal(await verifyUser(), false);
    assert.deepEqual(events, [["unsubscribe"], ["remove", "user"]]);
});

test("allowed user refreshes claims, sends access roles, and stores voting-compatible names", async () => {
    const { verifyUser, events } = await harness({ user: {}, apiKey: "local-key" });
    assert.equal(await verifyUser(), true);
    assert.deepEqual(events.slice(0, 2), [["unsubscribe"], ["token", true]]);
    const [url, request] = events.find(([kind]) => kind === "fetch").slice(1);
    assert.equal(url, "/api/brother/rush-app/check-access");
    assert.equal(request.method, "POST");
    assert.deepEqual(JSON.parse(JSON.stringify(request.headers)), {
        "Content-Type": "application/json",
        "X-API-Key": "local-key",
    });
    assert.deepEqual(JSON.parse(request.body), {
        uid: "uid-1", is_admin: true, is_bidcom: false,
    });
    const stored = JSON.parse(events.find(([kind]) => kind === "store")[2]);
    assert.deepEqual(stored, {
        _id: "uid-1", uid: "uid-1", email: "member@example.invalid",
        displayName: "Ada Grace Lovelace", firstname: "Ada", lastname: "Grace Lovelace",
        firstName: "Ada", lastName: "Grace Lovelace",
    });
});

test("denied access signs out, removes identity, and reports the server reason", async () => {
    const { verifyUser, events } = await harness({
        user: {},
        access: { status: "success", allowed: false, reason: "Rush paused" },
    });
    assert.equal(await verifyUser(), false);
    assert.deepEqual(events.filter(([kind]) => ["signOut", "remove"].includes(kind)), [
        ["signOut", true], ["remove", "user"],
    ]);
    const toast = events.find(([kind]) => kind === "toast");
    assert.equal(toast[1], "Rush paused");
    assert.equal(toast[2].autoClose, 6000);
    assert.equal(events.some(([kind]) => kind === "store"), false);
});

test("access-check and token failures preserve fail-open storage behavior", async () => {
    for (const errorKind of ["accessError", "tokenError"]) {
        const failure = new Error(errorKind);
        const { verifyUser, events } = await harness({ user: { displayName: null }, [errorKind]: failure });
        assert.equal(await verifyUser(), true);
        assert.equal(events.find(([kind]) => kind === "warn")[2], failure);
        assert.equal(events.some(([kind]) => kind === "store"), true);
        if (errorKind === "tokenError") {
            assert.equal(events.some(([kind]) => kind === "fetch"), false);
        }
        const stored = JSON.parse(events.find(([kind]) => kind === "store")[2]);
        assert.equal(stored.firstname, "");
        assert.equal(stored.lastname, "");
    }
});
