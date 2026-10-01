import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";
import { activeCursorsForField } from "../src/features/collaboration/activeCursorsForField.js";
import { reconcileRemoteFieldUpdate } from "../src/features/collaboration/reconcileRemoteFieldUpdate.js";
import { syncPropValue } from "../src/features/collaboration/syncPropValue.js";

const components = {
    input: fileURLToPath(new URL("../src/features/collaboration/CollaborativeInput.tsx", import.meta.url)),
    textarea: fileURLToPath(new URL("../src/components/CollaborativeTextarea.jsx", import.meta.url)),
};
const views = {
    input: fileURLToPath(new URL("../src/features/collaboration/CollaborativeInputView.tsx", import.meta.url)),
    textarea: fileURLToPath(new URL("../src/features/collaboration/CollaborativeTextareaView.tsx", import.meta.url)),
};

const cursors = [1, 2, 3, 4].map((index) => ({
    id: `user-${index}`, name: `Editor ${index}`, cursor: index,
}));

const scenarios = [
    ["input", "offline", false, [], { required: true }, "8fe9ef3fbc7cd20e89ed48cbbcd949936bfa852dababf0f8796911b02c75b011"],
    ["input", "locked", true, cursors, { required: true, disabled: true }, "289a15e5b027c1c6bc28f5fc2231bbce9827134ae859e952e1016afa6d4592d0"],
    ["textarea", "offline", false, [], {}, "edfb169c2c40cc30b1f4cf628e5552bf63161ecde793ef1a07154abdc6e52e76"],
    ["textarea", "locked", true, cursors, { disabled: true }, "0f070245fa71a79a6c467fef00302388f8748ffc3ad7a1be20d10d384871a0b1"],
];

for (const [kind, state, connected, activeCursors, extra, expectedHash] of scenarios) {
    test(`${kind} ${state} markup retains its original structure`, async () => {
        const View = await loadTsxComponent(views[kind]);
        const Component = await loadTsxComponent(components[kind], {
            "../features/collaboration/activeCursorsForField.js": { activeCursorsForField },
            "./activeCursorsForField.js": { activeCursorsForField },
            "../features/collaboration/reconcileRemoteFieldUpdate.js": { reconcileRemoteFieldUpdate },
            "./reconcileRemoteFieldUpdate.js": { reconcileRemoteFieldUpdate },
            "../features/collaboration/syncPropValue.js": { syncPropValue },
            "./syncPropValue.js": { syncPropValue },
            "../features/collaboration/CollaborativeInputView": View,
            "./CollaborativeInputView": View,
            "../features/collaboration/CollaborativeTextareaView": View,
        });
        const collaboration = {
            isConnected: connected,
            typingUsers: [],
            connectedUsers: [],
            remoteUpdates: [],
            getActiveCursorsForField: () => activeCursors,
        };
        const html = renderToStaticMarkup(React.createElement(Component, {
            [kind === "input" ? "fieldKey" : "questionKey"]: "notes",
            value: "Initial",
            onChange() {},
            placeholder: "Write here",
            className: "test-class",
            collaboration,
            currentUser: { id: "me" },
            ...extra,
        })).replace(/hsl\([^)]*\)/g, "hsl(RANDOM)");

        assert.equal(createHash("sha256").update(html).digest("hex"), expectedHash);
    });
}
