import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { transformWithEsbuild } from "vite";

const sourcePath = fileURLToPath(new URL("../src/api/configureAxios.js", import.meta.url));

async function loadAxiosSetup(apiKey) {
    const source = (await readFile(sourcePath, "utf8"))
        .replaceAll("import.meta.env.VITE_API_KEY", JSON.stringify(apiKey));
    const { code } = await transformWithEsbuild(source, sourcePath, { format: "cjs" });
    const axios = { defaults: { headers: { common: { Existing: "value" } } } };
    const messages = [];
    const module = { exports: {} };

    runInNewContext(code, {
        module,
        exports: module.exports,
        console: {
            log: (message) => messages.push(["log", message]),
            warn: (message) => messages.push(["warn", message]),
        },
        require(specifier) {
            if (specifier === "axios") return { default: axios, ...axios };
            throw new Error(`Unexpected import: ${specifier}`);
        },
    }, { filename: sourcePath });

    return { exported: module.exports.default, axios, messages };
}

test("startup Axios setup attaches the configured key to global defaults", async () => {
    const result = await loadAxiosSetup("rush-key");
    assert.equal(result.exported.defaults, result.axios.defaults);
    assert.equal(result.axios.defaults.headers.common.Existing, "value");
    assert.equal(result.axios.defaults.headers.common["X-API-Key"], "rush-key");
    assert.deepEqual(result.messages, [["log", "API key configured for axios requests"]]);
});

test("startup Axios setup preserves existing headers when the key is absent", async () => {
    const result = await loadAxiosSetup("");
    assert.equal(result.axios.defaults.headers.common.Existing, "value");
    assert.equal(Object.hasOwn(result.axios.defaults.headers.common, "X-API-Key"), false);
    assert.deepEqual(result.messages, [["warn", "VITE_API_KEY not set - API requests may be rejected"]]);
});
