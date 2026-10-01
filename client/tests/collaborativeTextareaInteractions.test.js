import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import React from "react";
import { transformWithEsbuild } from "vite";

const componentPath = fileURLToPath(new URL("../src/features/collaboration/CollaborativeTextarea.tsx", import.meta.url));

async function loadTextarea({ cursors = [] } = {}) {
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
        setTimeout(callback, delay) {
            const id = nextTimerId++;
            timers.set(id, { callback, delay });
            return id;
        },
        clearTimeout: (id) => timers.delete(id),
        require(specifier) {
            if (specifier === "react") {
                return {
                    ...React,
                    useRef: (initial) => ({ current: initial }),
                    useState: (initial) => [initial, (value) => stateChanges.push(value)],
                    useEffect: () => {},
                    useCallback: (callback) => callback,
                };
            }
            if (specifier === "./activeCursorsForField.js") {
                return { activeCursorsForField: () => cursors };
            }
            if (specifier === "./CollaborativeTextareaView") return () => null;
            if (specifier === "./reconcileRemoteFieldUpdate.js") {
                return { reconcileRemoteFieldUpdate: () => {} };
            }
            if (specifier === "./syncPropValue.js") return { syncPropValue: () => {} };
            return requireFromComponent(specifier);
        },
    }, { filename: componentPath });

    return { Component: module.exports.default, timers, stateChanges };
}

test("local text sends only the latest value after the 450 ms debounce", async () => {
    const { Component, timers, stateChanges } = await loadTextarea();
    const changes = [];
    const messages = [];
    const view = Component({
        questionKey: "notes",
        value: "before",
        onChange: (...args) => changes.push(args),
        collaboration: {
            isConnected: true,
            typingUsers: [],
            remoteUpdates: [],
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
    assert.deepEqual(Array.from(timers.values(), ({ delay }) => delay).sort((a, b) => a - b), [450, 2000]);

    const sendTimer = Array.from(timers.values()).find(({ delay }) => delay === 450);
    sendTimer.callback();
    assert.deepEqual(messages, [["notes", "latest"]]);
});

test("composition end sends its value and an occupied field rejects focus", async () => {
    const { Component, stateChanges } = await loadTextarea({ cursors: [{ id: "other", cursor: 2 }] });
    const messages = [];
    const view = Component({
        questionKey: "notes",
        value: "before",
        onChange: () => {},
        collaboration: {
            isConnected: true,
            typingUsers: [],
            remoteUpdates: [],
            sendTextUpdate: (...args) => messages.push(["text", ...args]),
            sendTypingIndicator: (...args) => messages.push(["typing", ...args]),
            sendCursorPosition: (...args) => messages.push(["cursor", ...args]),
        },
    });
    let blurred = false;
    let prevented = false;

    view.props.handleFocus({ target: { blur: () => { blurred = true; }, selectionStart: 4 } });
    view.props.handleMouseDown({ preventDefault: () => { prevented = true; } });
    view.props.handleCompositionEnd({ target: { value: "composed" } });

    assert.equal(blurred, true);
    assert.equal(prevented, true);
    assert.deepEqual(stateChanges, [false]);
    assert.deepEqual(messages, [["text", "notes", "composed"]]);
});
