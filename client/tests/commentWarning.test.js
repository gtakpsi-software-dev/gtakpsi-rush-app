import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../src/components/CommentWarning.tsx", import.meta.url));

test("comment warnings retain empty, icon-type, and dismissible markup", async () => {
    const Warning = await loadTsxComponent(componentPath);
    const cases = {
        empty: { warnings: [] },
        types: {
            warnings: [
                { type: "speculative", message: "Speculation" },
                { type: "name", message: "Name" },
                { type: "other", message: "Other" },
            ],
        },
        dismiss: {
            warnings: [{ type: "name", message: "Name" }],
            onDismiss: () => {},
        },
    };
    const hashes = Object.fromEntries(Object.entries(cases).map(([name, props]) => {
        const html = renderToStaticMarkup(React.createElement(Warning, props));
        return [name, createHash("sha256").update(html).digest("hex")];
    }));

    assert.deepEqual(hashes, {
        empty: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        types: "1f60121d8f78525ba96c279918da480a3f16fcbe8925e3fbc9539443b5be61b9",
        dismiss: "8b316ab1e5d134ef00176848426a22d19e0e2330ea6baf7d62645a054ba434a9",
    });
});

test("dismiss buttons retain the warning's original array index", async () => {
    const Warning = await loadTsxComponent(componentPath);
    const dismissed = [];
    const tree = Warning({
        warnings: [
            { type: "name", message: "First" },
            { type: "speculative", message: "Second" },
        ],
        onDismiss: (index) => dismissed.push(index),
    });
    const cards = React.Children.toArray(tree.props.children);
    for (const card of cards) {
        const button = React.Children.toArray(card.props.children).find((child) => child.type === "button");
        button.props.onClick();
    }

    assert.deepEqual(dismissed, [0, 1]);
});
