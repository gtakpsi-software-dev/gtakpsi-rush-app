import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { transformWithEsbuild } from "vite";

const sourcePath = fileURLToPath(new URL("../../src/api/client.js", import.meta.url));

async function loadApiClient({ apiPrefix = "/api", apiKey = "rush-key" } = {}) {
    const source = (await readFile(sourcePath, "utf8"))
        .replaceAll("import.meta.env.VITE_API_PREFIX", JSON.stringify(apiPrefix))
        .replaceAll("import.meta.env.VITE_API_KEY", JSON.stringify(apiKey));
    const { code } = await transformWithEsbuild(source, sourcePath, { format: "cjs" });
    const instances = [];
    const axios = {
        create(config) {
            const instance = {
                config,
                interceptors: {
                    request: {
                        use(onRequest, onError) {
                            instance.onRequest = onRequest;
                            instance.onError = onError;
                        },
                    },
                },
            };
            instances.push(instance);
            return instance;
        },
    };
    const module = { exports: {} };
    runInNewContext(code, {
        module,
        exports: module.exports,
        require(specifier) {
            if (specifier === "axios") return { default: axios, ...axios };
            throw new Error(`Unexpected import: ${specifier}`);
        },
    }, { filename: sourcePath });

    return { api: module.exports, instances };
}

test("the API client keeps the prefix and adds the API key", async () => {
    const { api, instances } = await loadApiClient();

    assert.equal(api.default, instances[0]);
    assert.equal(instances.length, 1);
    assert.equal(instances[0].config.baseURL, "/api");
    const request = { headers: {} };
    assert.equal(instances[0].onRequest(request), request);
    assert.equal(request.headers["X-API-Key"], "rush-key");
    const error = new Error("request failed");
    await assert.rejects(instances[0].onError(error), (reason) => reason === error);
});

test("missing environment settings retain empty prefix and leave headers untouched", async () => {
    const { instances } = await loadApiClient({ apiPrefix: "", apiKey: "" });
    assert.equal(instances.length, 1);
    assert.equal(instances[0].config.baseURL, "");
    const request = { headers: { Existing: "value" } };
    assert.equal(instances[0].onRequest(request), request);
    assert.equal(request.headers.Existing, "value");
    assert.equal(Object.hasOwn(request.headers, "X-API-Key"), false);
});
