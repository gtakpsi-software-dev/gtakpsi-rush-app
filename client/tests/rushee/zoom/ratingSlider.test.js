import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../../helpers/loadTsxComponent.js";

const sliderPath = fileURLToPath(new URL("../../../src/features/rushee/zoom/RatingSlider.tsx", import.meta.url));

test("rating slider retains enabled and not-seen markup", async () => {
    // Verify rating slider retains enabled and not-seen markup.
    const Slider = await loadTsxComponent(sliderPath);
    const hashes = [false, true].map((notSeen) => {
        // Hash slider markup for each observation state.
        const html = renderToStaticMarkup(React.createElement(Slider, {
            label: "Professionalism",
            value: 3,
            notSeen,
            // Provide an inert on value change stub for this test.
            onValueChange: () => {},
            // Provide an inert on not seen change stub for this test.
            onNotSeenChange: () => {},
        }));
        return createHash("sha256").update(html).digest("hex");
    });

    assert.deepEqual(hashes, [
        "9dec3f1e73562d47c600dce2148c697417a9649486e5080caeb4161c053fc29d",
        "9656e7422c08c6db66d282267eca744168a31e6f39dd0c16f62e15649b7e583a",
    ]);
});

test("rating slider retains numeric and not-seen callback values", async () => {
    // Verify rating slider retains numeric and not-seen callback values.
    const Slider = await loadTsxComponent(sliderPath);
    const changes = [];
    const tree = Slider({
        label: "Professionalism",
        value: 3,
        notSeen: false,
        // Record on value change calls for assertions.
        onValueChange: (value) => changes.push(["rating", value]),
        // Record on not seen change calls for assertions.
        onNotSeenChange: (value) => changes.push(["notSeen", value]),
    });
    // Walk the rendered element tree to collect nodes for assertions.
    const collectInputs = (node) => {
        if (!React.isValidElement(node)) return [];
        const children = React.Children.toArray(node.props.children);
        return [node, ...children.flatMap(collectInputs)];
    };
    const inputs = collectInputs(tree).filter(/* Identify rendered input elements. */ (node) => node.type === "input");

    inputs[0].props.onChange({ target: { checked: true } });
    inputs[1].props.onChange({ target: { value: "4" } });
    assert.deepEqual(changes, [["notSeen", true], ["rating", 4]]);
});
