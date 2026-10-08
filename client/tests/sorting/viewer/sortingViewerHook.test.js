import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { transformWithEsbuild } from "vite";
import { startSortingConnectionLifecycle } from "../../../src/features/sorting/startSortingConnectionLifecycle.js";

const hookPath = fileURLToPath(new URL(
    "../../../src/features/sorting/useSortingViewerConnection.js", import.meta.url,
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
        // Capture interval callbacks and return deterministic handles.
        setInterval(callback, delay) {
            const id = timers.length + 1;
            timers.push({ id, callback, delay });
            return id;
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
                "./connectSortingViewer": {
                    // Record connect sorting viewer calls for assertions.
                    connectSortingViewer: (options) => connections.push(options),
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
    return { hook: module.exports.useSortingViewerConnection, effects, connections,
        sweeps, timers, cleared };
}

for (const showRusheeNames of [true, false]) {
    test(`sorting viewer hook preserves ${showRusheeNames ? "brother" : "bidcom"} socket lifecycle`, async () => {
        // Verify viewer hook setup, ghost sweeps, and cleanup for each privacy mode.
        const { hook, effects, connections, sweeps, timers, cleared } = await setup();
        const user = { uid: "brother-1" };
        const closed = [];
        const options = {
            auth: { currentUser: user },
            wsRef: { current: { close: /* Record close calls for assertions. */ () => closed.push("close") } },
            ghostTimestampsRef: { current: {} },
            fetchDataRef: { current: /* Provide an inert current stub for this test. */ () => {} },
            // Provide an inert set ws connected stub for this test.
            setWsConnected() {},
                /* Provide an inert set viewer count stub for this test. */
                setViewerCount() {},
                /* Provide an inert set ghost cards stub for this test. */
                setGhostCards() {},
            showRusheeNames,
        };

        hook(options);
        assert.equal(effects.length, 1);
        assert.deepEqual(Array.from(effects[0].deps), []);
        const cleanup = effects[0].effect();

        assert.equal(connections.length, 1);
        assert.equal(connections[0].url, "ws://sorting/ws");
        assert.equal(connections[0].getCurrentUser(), user);
        assert.equal(connections[0].showRusheeNames, showRusheeNames);
        for (const key of ["wsRef", "ghostTimestampsRef", "fetchDataRef",
            "setWsConnected", "setViewerCount", "setGhostCards"]) {
            assert.equal(connections[0][key], options[key]);
        }

        assert.equal(timers.length, 1);
        assert.equal(timers[0].delay, 5000);
        timers[0].callback();
        assert.equal(sweeps.length, 1);
        assert.equal(sweeps[0].ghostTimestampsRef, options.ghostTimestampsRef);
        assert.equal(sweeps[0].setGhostCards, options.setGhostCards);

        cleanup();
        assert.deepEqual(closed, ["close"]);
        assert.deepEqual(cleared, [timers[0].id]);
    });
}

test("sorting viewer cleanup closes the latest reconnected socket", async () => {
    // Verify sorting viewer cleanup closes the latest reconnected socket.
    const { hook, effects } = await setup();
    const closed = [];
    const wsRef = { current: { close: /* Record close calls for assertions. */ () => closed.push("original") } };
    hook({
        auth: { currentUser: null }, wsRef,
        ghostTimestampsRef: { current: {} }, fetchDataRef: { current: null },
        // Provide an inert set ws connected stub for this test.
        setWsConnected() {},
            /* Provide an inert set viewer count stub for this test. */
            setViewerCount() {},
            /* Provide an inert set ghost cards stub for this test. */
            setGhostCards() {},
        showRusheeNames: true,
    });

    const cleanup = effects[0].effect();
    wsRef.current = { close: /* Record close calls for assertions. */ () => closed.push("reconnected") };
    cleanup();

    assert.deepEqual(closed, ["reconnected"]);
});
