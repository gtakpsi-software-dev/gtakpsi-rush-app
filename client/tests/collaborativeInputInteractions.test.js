import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import React from "react";
import { transformWithEsbuild } from "vite";
import { clearLocalChangeTimers, scheduleLocalChangeTimers } from "../src/features/collaboration/scheduleLocalChangeTimers.js";
import { loadTsxModule } from "./helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL(
    "../src/features/collaboration/CollaborativeInput.tsx", import.meta.url,
));
const presencePath = fileURLToPath(new URL(
    "../src/features/collaboration/useCollaborativeFieldPresence.ts", import.meta.url,
));

async function loadInput() {
    const presence = await loadTsxModule(presencePath, {
        react: { useCallback: (callback) => callback },
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
                return { activeCursorsForField: () => [] };
            }
            if (specifier === "./CollaborativeInputView") return () => null;
            if (specifier === "./reconcileRemoteFieldUpdate.js") {
                return { reconcileRemoteFieldUpdate: () => {} };
            }
            if (specifier === "./syncPropValue.js") return { syncPropValue: () => {} };
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
    const { Component, timers, stateChanges } = await loadInput();
    const changes = [];
    const messages = [];
    const view = Component({
        fieldKey: "first_name",
        value: "Before",
        onChange: (value) => changes.push(value),
        collaboration: {
            isConnected: true,
            typingUsers: [],
            remoteUpdates: [],
            sendTextUpdate: (...args) => messages.push(args),
        },
    });

    view.props.handleTextChange({ target: { value: "First" } });
    view.props.handleTextChange({ target: { value: "Latest" } });

    assert.deepEqual(stateChanges, ["First", "Latest"]);
    assert.deepEqual(changes, ["First", "Latest"]);
    assert.deepEqual(Array.from(timers.values(), ({ delay }) => delay).sort((a, b) => a - b), [300, 2000]);

    const sendTimer = Array.from(timers.values()).find(({ delay }) => delay === 300);
    sendTimer.callback();
    assert.deepEqual(messages, [["first_name", "Latest"]]);
});
