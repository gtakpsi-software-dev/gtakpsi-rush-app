import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../../helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../../../src/features/rushee/zoom/RusheeProfileHeader.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../../fixtures/rusheeZoomProfileHeader.json", import.meta.url));
const rushee = {
    image_url: "/photo.png", first_name: "Ada", last_name: "Example", pronouns: "she/her",
    email: "ada@example.com", major: "CS", class: "Junior", housing: "North", gtid: "123",
    attendance: [{ name: "Night 1" }, { name: "Night 2" }],
};
// The badge stub keeps the baseline markup independent of the shared component.
// eslint-disable-next-line react/prop-types
// Render a lightweight React element for component assertions.
const Badges = ({ text }) => React.createElement("span", { "data-badge": text }, text);

test("normal and bid committee profile headers retain original rendered markup", async () => {
    // Verify normal and bid committee profile headers retain original rendered markup.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const RusheeProfileHeader = await loadTsxComponent(componentPath, {
        "../../../components/Badge": Badges,
    });
    for (const [name, bidMode] of Object.entries({ normal: false, bidCommittee: true })) {
        const html = renderToStaticMarkup(React.createElement(RusheeProfileHeader, {
            rushee,
            // Return bid mode to the caller.
            isBidCommitteeMode: () => bidMode,
            // Return the fixed rushee number fixture.
            getRusheeNumber: () => "42",
        }));
        const hash = createHash("sha256").update(html).digest("hex");
        assert.equal(hash, expected[name], `${name} profile header changed`);
    }
});

test("bid committee number and privacy branches retain their existing checks", async () => {
    // Verify bid committee number and privacy branches retain their existing checks.
    const RusheeProfileHeader = await loadTsxComponent(componentPath, {
        "../../../components/Badge": Badges,
    });
    const calls = [];
    renderToStaticMarkup(React.createElement(RusheeProfileHeader, {
        rushee,
        // Record mode lookup and enable midterm mode.
        isBidCommitteeMode: () => { calls.push("mode"); return true; },
        // Record anonymous-number lookup and return the fixed number.
        getRusheeNumber: () => { calls.push("number"); return "42"; },
    }));
    assert.equal(calls.filter(/* Match call to "mode". */ (call) => call === "mode").length, 5);
    assert.equal(calls.filter(/* Match call to "number". */ (call) => call === "number").length, 2);
});
