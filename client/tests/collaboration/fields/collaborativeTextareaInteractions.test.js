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

const componentPath = fileURLToPath(new URL("../../../src/features/collaboration/CollaborativeTextarea.tsx", import.meta.url));
const presencePath = fileURLToPath(new URL("../../../src/features/collaboration/useCollaborativeFieldPresence.ts", import.meta.url));

// Load textarea with injected dependencies for isolated tests.
async function loadTextarea({ cursors = [] } = {}) {
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
                    // Supply controlled state and a setter without mounting React.
                    useState: (initial) => [initial, /* Record callback arguments for assertions. */ (value) => stateChanges.push(value)],
                    // Provide an inert use effect stub for this test.
                    useEffect: () => {},
                    // Keep the callback callable without a React render cycle.
                    useCallback: (callback) => callback,
                };
            }
            if (specifier === "./activeCursorsForField.js") {
                return { activeCursorsForField: /* Return cursors to the caller. */ () => cursors };
            }
            if (specifier === "./CollaborativeTextareaView") return /* Return null from this dependency stub. */ () => null;
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

test("local text sends only the latest value after the 450 ms debounce", async () => {
    // Verify local text sends only the latest value after the 450 ms debounce.
    const { Component, timers, stateChanges } = await loadTextarea();
    const changes = [];
    const messages = [];
    const view = Component({
        questionKey: "notes",
        value: "before",
        // Record on change calls for assertions.
        onChange: (...args) => changes.push(args),
        collaboration: {
            isConnected: true,
            typingUsers: [],
            remoteUpdates: [],
            // Record send text update calls for assertions.
            sendTextUpdate: (...args) => messages.push(args),
        },
    });

    view.props.handleTextChange({ target: { value: "first" } });
    view.props.handleTextChange({ target: { value: "latest" } });

    assert.deepEqual(stateChanges, ["first", "latest"]);
    assert.deepEqual(JSON.parse(JSON.stringify(changes)), [
        ["notes", "first", { source: "typing" }],
        ["notes", "latest", { source: "typing" }],
    ]);
    assert.deepEqual(Array.from(timers.values(),
        /* Return delay to the caller. */
        ({ delay }) => delay).sort(
        /* Sort timer delays in ascending order. */
        (a, b) => a - b), [450, 2000]);

    const sendTimer = Array.from(timers.values()).find(/* Match delay to 450. */ ({ delay }) => delay === 450);
    sendTimer.callback();
    assert.deepEqual(messages, [["notes", "latest"]]);
});

test("composition end sends its value and an occupied field rejects focus", async () => {
    // Verify composition end sends its value and an occupied field rejects focus.
    const { Component, stateChanges } = await loadTextarea({ cursors: [{ id: "other", cursor: 2 }] });
    const messages = [];
    const view = Component({
        questionKey: "notes",
        value: "before",
        // Provide an inert on change stub for this test.
        onChange: () => {},
        collaboration: {
            isConnected: true,
            typingUsers: [],
            remoteUpdates: [],
            // Record send text update calls for assertions.
            sendTextUpdate: (...args) => messages.push(["text", ...args]),
            // Record send typing indicator calls for assertions.
            sendTypingIndicator: (...args) => messages.push(["typing", ...args]),
            // Record send cursor position calls for assertions.
            sendCursorPosition: (...args) => messages.push(["cursor", ...args]),
        },
    });
    let blurred = false;
    let prevented = false;

    view.props.handleFocus({ target: { blur: () => {
        // Update blurred in the test harness.
         blurred = true; }, selectionStart: 4 } });
    view.props.handleMouseDown({ preventDefault: () => {
        // Update prevented in the test harness.
         prevented = true; } });
    view.props.handleCompositionEnd({ target: { value: "composed" } });

    assert.equal(blurred, true);
    assert.equal(prevented, true);
    assert.deepEqual(stateChanges, [false]);
    assert.deepEqual(messages, [["text", "notes", "composed"]]);
});
