import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { transformWithEsbuild } from "vite";

const hookPath = fileURLToPath(new URL(
    "../src/features/sorting/useSortingViewerConnection.js", import.meta.url,
));

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
        setInterval(callback, delay) {
            const id = timers.length + 1;
            timers.push({ id, callback, delay });
            return id;
        },
        clearInterval: (id) => cleared.push(id),
        require(specifier) {
            const dependencies = {
                react: { useEffect: (effect, deps) => effects.push({ effect, deps }) },
                "../../config/realtimeBaseUrls": {
                    realtimeBaseUrls: { sorting: "ws://sorting" },
                },
                "./connectSortingViewer": {
                    connectSortingViewer: (options) => connections.push(options),
                },
                "./cleanupStaleSortingGhosts": {
                    cleanupStaleSortingGhosts: (options) => sweeps.push(options),
                },
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
        const { hook, effects, connections, sweeps, timers, cleared } = await setup();
        const user = { uid: "brother-1" };
        const closed = [];
        const options = {
            auth: { currentUser: user },
            wsRef: { current: { close: () => closed.push("close") } },
            ghostTimestampsRef: { current: {} },
            fetchDataRef: { current: () => {} },
            setWsConnected() {}, setViewerCount() {}, setGhostCards() {},
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
    const { hook, effects } = await setup();
    const closed = [];
    const wsRef = { current: { close: () => closed.push("original") } };
    hook({
        auth: { currentUser: null }, wsRef,
        ghostTimestampsRef: { current: {} }, fetchDataRef: { current: null },
        setWsConnected() {}, setViewerCount() {}, setGhostCards() {},
        showRusheeNames: true,
    });

    const cleanup = effects[0].effect();
    wsRef.current = { close: () => closed.push("reconnected") };
    cleanup();

    assert.deepEqual(closed, ["reconnected"]);
});
