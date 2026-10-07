import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../../helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../../../src/features/rushee/zoom/RusheeRatings.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../../fixtures/rusheeZoomRatings.json", import.meta.url));
const rushee = {
    ratings: [{ name: "Why AKPsi", value: 3.25 }, { name: "Professionalism", value: 4 }],
    interactions_by_night: [{ name: "Night 1" }],
    attendance: [{ name: "Night 1" }],
    comments: [{ comment: "Hello" }],
};

test("ratings card retains visible and hidden markup", async () => {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const Interactions = () => React.createElement("section", { "data-test-interactions": "true" });
    const RusheeRatings = await loadTsxComponent(componentPath, {
        "../../../components/RusheeInteractionsByNight": Interactions,
    });

    for (const [name, showAllComments] of Object.entries({ visible: true, hidden: false })) {
        const html = renderToStaticMarkup(React.createElement(RusheeRatings, { rushee, showAllComments }));
        assert.equal(createHash("sha256").update(html).digest("hex"), expected[name]);
    }
});

test("interactions retain the original data in both visibility states", async () => {
    const calls = [];
    const Interactions = (props) => {
        calls.push(props);
        return React.createElement("section");
    };
    const RusheeRatings = await loadTsxComponent(componentPath, {
        "../../../components/RusheeInteractionsByNight": Interactions,
    });

    for (const showAllComments of [true, false]) {
        renderToStaticMarkup(React.createElement(RusheeRatings, { rushee, showAllComments }));
    }
    assert.equal(calls.length, 2);
    for (const props of calls) {
        assert.equal(props.nights, rushee.interactions_by_night);
        assert.equal(props.attendance, rushee.attendance);
        assert.equal(props.comments, rushee.comments);
    }
});
