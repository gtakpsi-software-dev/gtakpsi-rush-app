import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { transformWithEsbuild } from "vite";

const sourcePath = fileURLToPath(new URL("../../src/features/admin/api.js", import.meta.url));

async function loadAdminApi({ user = null, apiKey = "rush-key" } = {}) {
    const source = (await readFile(sourcePath, "utf8"))
        .replaceAll("import.meta.env.VITE_API_KEY", JSON.stringify(apiKey));
    const { code } = await transformWithEsbuild(source, sourcePath, { format: "cjs" });
    const module = { exports: {} };
    const events = [];
    const axios = {
        create(config) {
            events.push(["create", config.headers.Authorization, config.headers["X-API-Key"]]);
            return Object.fromEntries(["get", "post", "put"].map((method) => [
                method,
                async (...args) => {
                    events.push([method, ...args]);
                    return { method, args };
                },
            ]));
        },
    };

    runInNewContext(code, {
        module,
        exports: module.exports,
        require(specifier) {
            if (specifier === "axios") return { default: axios, ...axios };
            if (specifier === "../../firebase") return { auth: { currentUser: user } };
            throw new Error(`Unexpected import: ${specifier}`);
        },
    }, { filename: sourcePath });

    return { api: module.exports, events };
}

test("admin requests reject missing authentication before creating a client", async () => {
    const { api, events } = await loadAdminApi();
    await assert.rejects(api.getAdminAxios(), /Not authenticated/);
    await assert.rejects(api.adminGet("/api/admin/one"), /Not authenticated/);
    assert.deepEqual(events, []);
});

test("admin requests attach a fresh token and forward methods and payloads", async () => {
    const events = [];
    const user = { async getIdToken() { events.push("token"); return "id-token"; } };
    const harness = await loadAdminApi({ user });

    assert.equal((await harness.api.adminGet("/one")).method, "get");
    assert.equal((await harness.api.adminPost("/two", { value: 1 })).method, "post");
    assert.equal((await harness.api.adminPut("/three", { value: 2 })).method, "put");
    assert.deepEqual(events, ["token", "token", "token"]);
    assert.deepEqual(harness.events, [
        ["create", "Bearer id-token", "rush-key"], ["get", "/one"],
        ["create", "Bearer id-token", "rush-key"], ["post", "/two", { value: 1 }],
        ["create", "Bearer id-token", "rush-key"], ["put", "/three", { value: 2 }],
    ]);
});

test("admin requests omit the optional API-key header when unset", async () => {
    const { api, events } = await loadAdminApi({
        user: { async getIdToken() { return "id-token"; } },
        apiKey: "",
    });
    await api.getAdminAxios();
    assert.deepEqual(events, [["create", "Bearer id-token", undefined]]);
});
