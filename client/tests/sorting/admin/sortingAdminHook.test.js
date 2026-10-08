import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { transformWithEsbuild } from "vite";
import { startSortingConnectionLifecycle } from "../../../src/features/sorting/startSortingConnectionLifecycle.js";

const hookPath = fileURLToPath(new URL(
    "../../../src/features/sorting/useSortingAdminConnection.js", import.meta.url,
));

// Create isolated state, dependency fakes, and captured calls for this test.
async function setup() {
    const source = await readFile(hookPath, "utf8");
    const { code } = await transformWithEsbuild(source, hookPath, {
        loader: "js", format: "cjs",
    });
    const module = { exports: {} };
    const effects = [];
    const connections = [];
    const sweeps = [];
    const timers = [];
    const cleared = [];
    runInNewContext(code, {
        module,
        exports: module.exports,
        // Capture the interval callback and return a fixed handle.
        setInterval(callback, delay) {
            timers.push({ callback, delay });
            return 9;
        },
        // Record clear interval calls for assertions.
        clearInterval: (id) => cleared.push(id),
        // Resolve injected test dependencies before falling back to real modules.
        require(specifier) {
            const dependencies = {
                react: { useEffect: /* Capture effects so the test can run them explicitly. */ (effect, deps) => effects.push({ effect, deps }) },
                "../../config/realtimeBaseUrls": {
                    realtimeBaseUrls: { sorting: "ws://sorting" },
                },
                "./connectSortingAdmin": {
                    // Record connect sorting admin calls for assertions.
                    connectSortingAdmin: (options) => connections.push(options),
                },
                "./cleanupStaleSortingGhosts": {
                    // Record cleanup stale sorting ghosts calls for assertions.
                    cleanupStaleSortingGhosts: (options) => sweeps.push(options),
                },
                "./startSortingConnectionLifecycle": { startSortingConnectionLifecycle },
            };
            assert.ok(Object.hasOwn(dependencies, specifier), specifier);
            return dependencies[specifier];
        },
    }, { filename: hookPath });
    return { hook: module.exports.useSortingAdminConnection, effects, connections,
        sweeps, timers, cleared };
}

test("admin sorting hook preserves socket options, ghost cleanup, and unmount", async () => {
    // Verify admin sorting hook preserves socket options, ghost cleanup, and unmount.
    const { hook, effects, connections, sweeps, timers, cleared } = await setup();
    const user = { uid: "admin-1" };
    const closed = [];
    // Provide an inert cancel drag state stub for this test.
    const cancelDragState = () => {};
    const options = {
        auth: { currentUser: user },
        wsRef: { current: { close: /* Record close calls for assertions. */ () => closed.push("original") } },
        draggingRef: { current: null },
        ghostTimestampsRef: { current: {} },
        fetchDataRef: { current: /* Provide an inert current stub for this test. */ () => {} },
        // Provide an inert set ws connected stub for this test.
        setWsConnected() {},
            /* Provide an inert set viewer count stub for this test. */
            setViewerCount() {},
            /* Provide an inert set ghost cards stub for this test. */
            setGhostCards() {},
        // Provide an inert set locked cards stub for this test.
        setLockedCards() {},
        // Return cancel drag state to the caller.
        getCancelDragState: () => cancelDragState,
    };

    hook(options);
    assert.equal(effects.length, 1);
    assert.deepEqual(Array.from(effects[0].deps), []);
    const cleanup = effects[0].effect();

    assert.equal(connections.length, 1);
    assert.equal(connections[0].url, "ws://sorting/ws");
    assert.equal(connections[0].getCurrentUser(), user);
    assert.equal(connections[0].cancelDragState, cancelDragState);
    for (const key of ["wsRef", "draggingRef", "ghostTimestampsRef", "fetchDataRef",
        "setWsConnected", "setViewerCount", "setGhostCards", "setLockedCards"]) {
        assert.equal(connections[0][key], options[key]);
    }

    assert.equal(timers.length, 1);
    assert.equal(timers[0].delay, 5000);
    timers[0].callback();
    assert.equal(sweeps.length, 1);
    for (const key of ["ghostTimestampsRef", "setGhostCards", "setLockedCards"]) {
        assert.equal(sweeps[0][key], options[key]);
    }

    options.wsRef.current = { close: /* Record close calls for assertions. */ () => closed.push("reconnected") };
    cleanup();
    assert.deepEqual(closed, ["reconnected"]);
    assert.deepEqual(cleared, [9]);
});
