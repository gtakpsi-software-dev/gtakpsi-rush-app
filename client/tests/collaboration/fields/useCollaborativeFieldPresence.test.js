import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadTsxModule } from "../../helpers/loadTsxComponent.js";

const hookPath = fileURLToPath(new URL("../../../src/features/collaboration/useCollaborativeFieldPresence.ts", import.meta.url));

// Load hook with injected dependencies for isolated tests.
async function loadHook() {
    const module = await loadTsxModule(hookPath, {
        react: { useCallback: /* Keep the callback callable without a React render cycle. */ (callback) => callback },
    });
    return module.useCollaborativeFieldPresence;
}

// Create isolated state, dependency fakes, and captured calls for this test.
function setup({ locked = false, connected = true, fieldValue = "Current", clearCursor = true } = {}) {
    const calls = [];
    const fieldRef = { current: { value: fieldValue } };
    const lastSentValueRef = { current: "Earlier" };
    const collaboration = {
        isConnected: connected,
        // Record send typing indicator calls for assertions.
        sendTypingIndicator: (...args) => calls.push(["typing", ...args]),
        // Record send cursor position calls for assertions.
        sendCursorPosition: (...args) => calls.push(["cursor", ...args]),
        // Record send text update calls for assertions.
        sendTextUpdate: (...args) => calls.push(["text", ...args]),
    };
    if (clearCursor) {
        collaboration.clearCursorPosition = /* Record callback arguments for assertions. */ (...args) => calls.push(["clear", ...args]);
    }
    return { calls, fieldRef, lastSentValueRef, collaboration, locked };
}

test("focus announces typing and blur flushes the current field value", async () => {
    // Verify focus announces typing and blur flushes the current field value.
    const usePresence = await loadHook();
    const state = setup();
    const handlers = usePresence({
        fieldKey: "notes", localValue: "Old local", isFieldLocked: false,
        collaboration: state.collaboration, fieldRef: state.fieldRef,
        lastSentValueRef: state.lastSentValueRef,
    });
    let prevented = false;

    handlers.handleFocus({ target: { selectionStart: 4 } });
    handlers.handleMouseDown({ preventDefault: () => {
        // Update prevented in the test harness.
         prevented = true; } });
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
    // Verify locked fields blur on focus and prevent mouse focus without broadcasting.
    const usePresence = await loadHook();
    const state = setup({ locked: true });
    const handlers = usePresence({
        fieldKey: "notes", localValue: "Local", isFieldLocked: state.locked,
        collaboration: state.collaboration, fieldRef: state.fieldRef,
        lastSentValueRef: state.lastSentValueRef,
    });
    let blurred = false;
    let prevented = false;

    handlers.handleFocus({ target: { blur: () => {
        // Update blurred in the test harness.
         blurred = true; }, selectionStart: 2 } });
    handlers.handleMouseDown({ preventDefault: () => {
        // Update prevented in the test harness.
         prevented = true; } });

    assert.equal(blurred, true);
    assert.equal(prevented, true);
    assert.deepEqual(state.calls, []);
});

test("blur while disconnected clears presence without sending text", async () => {
    // Verify blur while disconnected clears presence without sending text.
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
    // Verify missing DOM value and optional clear method retain local-value fallbacks.
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
