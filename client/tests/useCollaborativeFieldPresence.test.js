import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadTsxModule } from "./helpers/loadTsxComponent.js";

const hookPath = fileURLToPath(new URL("../src/features/collaboration/useCollaborativeFieldPresence.ts", import.meta.url));

async function loadHook() {
    const module = await loadTsxModule(hookPath, {
        react: { useCallback: (callback) => callback },
    });
    return module.useCollaborativeFieldPresence;
}

function setup({ locked = false, connected = true, fieldValue = "Current", clearCursor = true } = {}) {
    const calls = [];
    const fieldRef = { current: { value: fieldValue } };
    const lastSentValueRef = { current: "Earlier" };
    const collaboration = {
        isConnected: connected,
        sendTypingIndicator: (...args) => calls.push(["typing", ...args]),
        sendCursorPosition: (...args) => calls.push(["cursor", ...args]),
        sendTextUpdate: (...args) => calls.push(["text", ...args]),
    };
    if (clearCursor) {
        collaboration.clearCursorPosition = (...args) => calls.push(["clear", ...args]);
    }
    return { calls, fieldRef, lastSentValueRef, collaboration, locked };
}

test("focus announces typing and blur flushes the current field value", async () => {
    const usePresence = await loadHook();
    const state = setup();
    const handlers = usePresence({
        fieldKey: "notes", localValue: "Old local", isFieldLocked: false,
        collaboration: state.collaboration, fieldRef: state.fieldRef,
        lastSentValueRef: state.lastSentValueRef,
    });
    let prevented = false;

    handlers.handleFocus({ target: { selectionStart: 4 } });
    handlers.handleMouseDown({ preventDefault: () => { prevented = true; } });
    handlers.handleBlur();

    assert.equal(prevented, false);
    assert.deepEqual(state.calls, [
        ["typing", "notes", true], ["cursor", "notes", 4],
        ["typing", "notes", false], ["clear", "notes"],
        ["text", "notes", "Current"],
    ]);
    assert.equal(state.lastSentValueRef.current, "Current");
});

test("locked fields blur on focus and prevent mouse focus without broadcasting", async () => {
    const usePresence = await loadHook();
    const state = setup({ locked: true });
    const handlers = usePresence({
        fieldKey: "notes", localValue: "Local", isFieldLocked: state.locked,
        collaboration: state.collaboration, fieldRef: state.fieldRef,
        lastSentValueRef: state.lastSentValueRef,
    });
    let blurred = false;
    let prevented = false;

    handlers.handleFocus({ target: { blur: () => { blurred = true; }, selectionStart: 2 } });
    handlers.handleMouseDown({ preventDefault: () => { prevented = true; } });

    assert.equal(blurred, true);
    assert.equal(prevented, true);
    assert.deepEqual(state.calls, []);
});

test("blur while disconnected clears presence without sending text", async () => {
    const usePresence = await loadHook();
    const state = setup({ connected: false });
    const handlers = usePresence({
        fieldKey: "answer", localValue: "Local", isFieldLocked: false,
        collaboration: state.collaboration, fieldRef: state.fieldRef,
        lastSentValueRef: state.lastSentValueRef,
    });

    handlers.handleBlur();
    assert.deepEqual(state.calls, [["typing", "answer", false], ["clear", "answer"]]);
    assert.equal(state.lastSentValueRef.current, "Earlier");
});

test("missing DOM value and optional clear method retain local-value fallbacks", async () => {
    const usePresence = await loadHook();
    const state = setup({ clearCursor: false });
    state.fieldRef.current = null;
    const handlers = usePresence({
        fieldKey: "answer", localValue: "Local", isFieldLocked: false,
        collaboration: state.collaboration, fieldRef: state.fieldRef,
        lastSentValueRef: state.lastSentValueRef,
    });

    handlers.handleFocus({ target: { selectionStart: null } });
    handlers.handleBlur();
    assert.deepEqual(state.calls, [
        ["typing", "answer", true], ["cursor", "answer", 0],
        ["typing", "answer", false], ["text", "answer", "Local"],
    ]);
    assert.equal(state.lastSentValueRef.current, "Local");
});
