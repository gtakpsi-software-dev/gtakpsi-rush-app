import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import React from "react";
import { transformWithEsbuild } from "vite";
import { clearLocalChangeTimers, scheduleLocalChangeTimers } from "../../../src/features/collaboration/scheduleLocalChangeTimers.js";
import { loadTsxModule } from "../../helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL(
    "../../../src/features/collaboration/CollaborativeInput.tsx", import.meta.url,
));
const presencePath = fileURLToPath(new URL(
    "../../../src/features/collaboration/useCollaborativeFieldPresence.ts", import.meta.url,
));

// Load input with injected dependencies for isolated tests.
async function loadInput() {
    const presence = await loadTsxModule(presencePath, {
        react: { useCallback: /* Keep the callback callable without a React render cycle. */ (callback) => callback },
    });
    const source = await readFile(componentPath, "utf8");
    const { code } = await transformWithEsbuild(source, componentPath, {
        loader: "tsx", format: "cjs", jsx: "automatic",
    });
    const module = { exports: {} };
    const requireFromComponent = createRequire(componentPath);
    const timers = new Map();
    const stateChanges = [];
    let nextTimerId = 1;

    runInNewContext(code, {
        module,
        exports: module.exports,
        // Store timeout callbacks and delays for explicit test execution.
        setTimeout(callback, delay) {
            const id = nextTimerId++;
            timers.set(id, { callback, delay });
            return id;
        },
        // Invoke timers.delete with the test inputs.
        clearTimeout: (id) => timers.delete(id),
        // Resolve injected test dependencies before falling back to real modules.
        require(specifier) {
            if (specifier === "react") {
                return {
                    ...React,
                    // Provide a mutable ref without mounting a React component.
                    useRef: (initial) => ({ current: initial }),
                    // Expose controlled hook state and capture updates for assertions.
                    useState: (initial) => [initial, /* Record callback arguments for assertions. */ (value) => stateChanges.push(value)],
                    // Provide an inert use effect stub for this test.
                    useEffect: () => {},
                    // Keep the callback callable without a React render cycle.
                    useCallback: (callback) => callback,
                };
            }
            if (specifier === "./activeCursorsForField.js") {
                return { activeCursorsForField: /* Return the active cursors for field fixture for this scenario. */ () => [] };
            }
            if (specifier === "./CollaborativeInputView") return /* Return no value from this dependency stub. */ () => null;
            if (specifier === "./reconcileRemoteFieldUpdate.js") {
                return { reconcileRemoteFieldUpdate: /* Provide an inert reconcile remote field update stub for this test. */ () => {} };
            }
            if (specifier === "./syncPropValue.js") return { syncPropValue: /* Provide an inert sync prop value stub for this test. */ () => {} };
            if (specifier === "./scheduleLocalChangeTimers.js") {
                return { clearLocalChangeTimers, scheduleLocalChangeTimers };
            }
            if (specifier === "./useCollaborativeFieldPresence") return presence;
            return requireFromComponent(specifier);
        },
    }, { filename: componentPath });

    return { Component: module.exports.default, timers, stateChanges };
}

test("collaborative input sends the latest local value after 300 ms", async () => {
    // Verify collaborative input sends the latest local value after 300 ms.
    const { Component, timers, stateChanges } = await loadInput();
    const changes = [];
    const messages = [];
    const view = Component({
        fieldKey: "first_name",
        value: "Before",
        // Record on change calls for assertions.
        onChange: (value) => changes.push(value),
        collaboration: {
            isConnected: true,
            typingUsers: [],
            remoteUpdates: [],
            // Record send text update calls for assertions.
            sendTextUpdate: (...args) => messages.push(args),
        },
    });

    view.props.handleTextChange({ target: { value: "First" } });
    view.props.handleTextChange({ target: { value: "Latest" } });

    assert.deepEqual(stateChanges, ["First", "Latest"]);
    assert.deepEqual(changes, ["First", "Latest"]);
    assert.deepEqual(Array.from(timers.values(),
        /* Return delay to the caller. */
        ({ delay }) => delay).sort(
        /* Sort timer delays in ascending order. */
        (a, b) => a - b), [300, 2000]);

    const sendTimer = Array.from(timers.values()).find(/* Match delay to 300. */ ({ delay }) => delay === 300);
    sendTimer.callback();
    assert.deepEqual(messages, [["first_name", "Latest"]]);
});
