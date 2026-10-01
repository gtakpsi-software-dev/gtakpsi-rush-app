import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { transformWithEsbuild } from "vite";

const hookPath = fileURLToPath(new URL("../src/features/pis/useCollaboration.js", import.meta.url));

async function loadHook(connected) {
    const source = await readFile(hookPath, "utf8");
    const { code } = await transformWithEsbuild(source, hookPath, { format: "cjs" });
    const module = { exports: {} };
    const events = [];
    const socket = {
        emit(name, payload) {
            events.push([name, payload === undefined ? undefined : JSON.parse(JSON.stringify(payload))]);
        },
    };
    const state = [socket, [], [], [], connected, new Map(), {}, {}];
    let stateIndex = 0;
    const noop = () => {};
    const dependencies = {
        react: {
            useState: () => [state[stateIndex++], noop],
            useRef: (initial) => ({ current: initial }),
            useEffect: noop,
            useCallback: (callback) => callback,
        },
        "socket.io-client": { io: noop },
        "../../config/realtimeBaseUrls.js": { realtimeBaseUrls: { pisCollaboration: "ws://local" } },
        "./registerCollaborationConnectionEvents.js": { registerCollaborationConnectionEvents: noop },
        "./registerCollaborationFieldEvents.js": { registerCollaborationFieldEvents: noop },
        "./registerCollaborationTextEvents.js": { registerCollaborationTextEvents: noop },
        "./collaborationPresence.js": {
            pruneTypingUsers: noop, clearStaleCursors: noop, getActiveCursors: noop,
        },
        "./operations.js": {
            applyOperation: noop, createOperation: noop, createOperationsFromDiff: noop,
        },
    };

    runInNewContext(code, {
        module,
        exports: module.exports,
        Math: { random: () => 0.5 },
        Date: class { static now() { return 123; } },
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            throw new Error(`Unexpected import: ${specifier}`);
        },
    }, { filename: hookPath });

    const currentUser = { id: "member-1", firstName: "Ada", lastName: "Lovelace" };
    return { commands: module.exports.useCollaboration("pis-1", currentUser), events };
}

test("connected collaboration commands retain their emitted event names and payloads", async () => {
    const { commands, events } = await loadHook(true);
    const operation = { type: "insert", field: "answer", content: "A" };
    commands.sendTextOperation(operation);
    commands.sendTextUpdate("answer", "Ada");
    commands.sendCursorPosition("answer", 4);
    commands.clearCursorPosition("answer");
    commands.sendTypingIndicator("answer", true);
    commands.requestDocumentState();

    assert.deepEqual(events, [
        ["text-operation", operation],
        ["text-update", {
            field: "answer", value: "Ada", baseVersion: 0, clientUpdateId: "i",
            userId: "member-1", userName: "Ada Lovelace",
        }],
        ["cursor-position", { field: "answer", position: 4, timestamp: 123 }],
        ["cursor-position", { field: "answer", position: null, timestamp: 123 }],
        ["typing-indicator", { field: "answer", isTyping: true, timestamp: 123 }],
        ["request-document-state", undefined],
    ]);
});

test("disconnected collaboration commands do not emit events", async () => {
    const { commands, events } = await loadHook(false);
    commands.sendTextOperation({ type: "insert" });
    commands.sendTextUpdate("answer", "Ada");
    commands.sendCursorPosition("answer", 4);
    commands.clearCursorPosition("answer");
    commands.sendTypingIndicator("answer", true);
    commands.requestDocumentState();
    assert.deepEqual(events, []);
});
