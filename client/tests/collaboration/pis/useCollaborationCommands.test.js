import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { transformWithEsbuild } from "vite";

const hookPath = fileURLToPath(new URL("../../../src/features/pis/useCollaborationCommands.js", import.meta.url));

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
    const lastOperationRef = { current: null };
    const pendingUpdatesRef = { current: {} };
    const dependencies = {
        react: {
            useCallback: (callback) => callback,
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
    const commands = module.exports.useCollaborationCommands({
        socket, isConnected: connected, currentUser, lastOperationRef,
        knownVersionsRef: { current: {} }, pendingUpdatesRef,
    });
    return { commands, events, lastOperationRef, pendingUpdatesRef };
}

test("connected collaboration commands retain their emitted event names and payloads", async () => {
    const { commands, events, lastOperationRef, pendingUpdatesRef } = await loadHook(true);
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
    assert.equal(lastOperationRef.current, operation);
    assert.equal(pendingUpdatesRef.current.answer.value, "Ada");
    assert.equal(pendingUpdatesRef.current.answer.clientUpdateId, "i");
});

test("disconnected collaboration commands do not emit events", async () => {
    const { commands, events, lastOperationRef, pendingUpdatesRef } = await loadHook(false);
    commands.sendTextOperation({ type: "insert" });
    commands.sendTextUpdate("answer", "Ada");
    commands.sendCursorPosition("answer", 4);
    commands.clearCursorPosition("answer");
    commands.sendTypingIndicator("answer", true);
    commands.requestDocumentState();
    assert.deepEqual(events, []);
    assert.equal(lastOperationRef.current, null);
    assert.deepEqual(pendingUpdatesRef.current, {});
});
