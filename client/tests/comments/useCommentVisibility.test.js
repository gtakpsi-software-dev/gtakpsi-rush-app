import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { transformWithEsbuild } from "vite";
import { shouldShowAllComments } from "../../src/features/comments/commentVisibility.js";

const hookPath = fileURLToPath(new URL("../../src/features/comments/useCommentVisibility.js", import.meta.url));

// Load hook with injected dependencies for isolated tests.
async function loadHook({ status, user, requestError } = {}) {
    const source = (await readFile(hookPath, "utf8"))
        .replaceAll("import.meta.env.VITE_API_PREFIX", '"/api"');
    const { code } = await transformWithEsbuild(source, hookPath, { format: "cjs" });
    const module = { exports: {} };
    const requests = [];
    const updates = [];
    let effect;
    let stateIndex = 0;
    const axios = {
        // Record visibility lookup and return settings or the configured error.
        async get(path) {
            requests.push(path);
            if (requestError) throw requestError;
            return { data: status };
        },
    };
    const dependencies = {
        react: {
            // Supply controlled state and a setter without mounting React.
            useState(initial) {
                const index = stateIndex++;
                return [initial, /* Record callback arguments for assertions. */ (value) => updates.push([index, value])];
            },
            // Update effect in the test harness.
            useEffect(callback) { effect = callback; },
        },
        axios: { default: axios, ...axios },
        "../../firebase": { auth: { currentUser: user } },
        "./commentVisibility.js": { shouldShowAllComments },
    };

    runInNewContext(code, {
        module,
        exports: module.exports,
        // Resolve injected test dependencies before falling back to real modules.
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            throw new Error(`Unexpected import: ${specifier}`);
        },
    }, { filename: hookPath });

    return { hook: module.exports.useCommentVisibility(), runEffect: /* Invoke effect with the test inputs. */ () => effect(), requests, updates };
}

test("comment visibility loads server policy before refreshing role claims", async () => {
    // Verify comment visibility loads server policy before refreshing role claims.
    const tokenCalls = [];
    const harness = await loadHook({
        status: { status: "success", require_comment_to_view: false },
        user: {
            // Record token refresh and return administrator claims.
            async getIdTokenResult(forceRefresh) {
                tokenCalls.push(forceRefresh);
                return { claims: { admin: true, bidcom: false } };
            },
        },
    });
    assert.equal(harness.hook.showAll, false);
    harness.runEffect();
    await setImmediate();

    assert.deepEqual(harness.requests, ["/api/brother/comment-visibility/status"]);
    assert.deepEqual(tokenCalls, [true]);
    assert.deepEqual(harness.updates, [[0, false], [1, true], [2, false]]);
});

test("comment visibility keeps restrictive defaults when requests fail", async () => {
    // Verify comment visibility keeps restrictive defaults when requests fail.
    const harness = await loadHook({
        requestError: new Error("offline"),
        user: { async getIdTokenResult() {
            // Simulate a dependency failure for this scenario.
             throw new Error("token failed"); } },
    });
    assert.deepEqual({ ...harness.hook.visibilityOptions }, {
        requireCommentToView: true, isAdmin: false, isBidcom: false,
    });
    assert.equal(harness.hook.showAll, false);
    harness.runEffect();
    await setImmediate();

    assert.deepEqual(harness.requests, ["/api/brother/comment-visibility/status"]);
    assert.deepEqual(harness.updates, []);
});
