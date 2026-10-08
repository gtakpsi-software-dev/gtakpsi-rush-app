import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../../helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../../../src/features/rushee/zoom/RusheePisDetails.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../../fixtures/rusheeZoomPisDetails.json", import.meta.url));
const rushee = {
    pis_timeslot: { $date: { $numberLong: "1712345678901" } },
    pis_signup: {
        first_brother_first_name: "Ari",
        first_brother_last_name: "One",
        second_brother_first_name: "Bea",
        second_brother_last_name: "Two",
    },
    pis: [
        { question: "Why join?", answer: "Community" },
        { question: "Experience?", answer: "Projects" },
    ],
};

// Walk the rendered element tree to collect nodes for assertions.
function collectClickable(node, clickable = []) {
    if (Array.isArray(node)) {
        node.forEach(/* Invoke collectClickable with the test inputs. */ (child) => collectClickable(child, clickable));
    } else if (React.isValidElement(node)) {
        if (node.props.onClick) clickable.push(node);
        collectClickable(node.props.children, clickable);
    }
    return clickable;
}

test("PIS details retain populated and empty response markup", async () => {
    // Verify PIS details retain populated and empty response markup.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const dateCalls = [];
    // Return the dayjs fixture for this scenario.
    const dayjs = (value) => ({
        // Capture date formatting inputs and return an inspectable label.
        format(pattern) {
            dateCalls.push([value, pattern]);
            return `date(${value},${pattern})`;
        },
    });
    const RusheePisDetails = await loadTsxComponent(componentPath, { dayjs });

    for (const [name, pis] of Object.entries({ responses: rushee.pis, empty: [] })) {
        const html = renderToStaticMarkup(React.createElement(RusheePisDetails, {
            rushee: { ...rushee, pis },
            // Provide an inert set selected pis stub for this test.
            setSelectedPis: () => {},
        }));
        assert.equal(createHash("sha256").update(html).digest("hex"), expected[name]);
    }
    assert.deepEqual(dateCalls, [
        [1712345678901, "ddd, DD MMM YYYY h:mm A"],
        [1712345678901, "ddd, DD MMM YYYY h:mm A"],
    ]);
});

test("each response opens the original PIS object", async () => {
    // Verify each response opens the original PIS object.
    const RusheePisDetails = await loadTsxComponent(componentPath, {
        // Return the dayjs fixture for this scenario.
        dayjs: () => ({ format: /* Return the fixed format fixture. */ () => "date" }),
    });
    const selected = [];
    const tree = RusheePisDetails({ rushee, setSelectedPis: /* Record set selected pis calls for assertions. */ (pis) => selected.push(pis) });
    const cards = collectClickable(tree);
    assert.equal(cards.length, rushee.pis.length);
    cards.forEach(/* Invoke card.props.onClick with the test inputs. */ (card) => card.props.onClick());
    assert.equal(selected[0], rushee.pis[0]);
    assert.equal(selected[1], rushee.pis[1]);
});
