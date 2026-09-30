import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../src/features/rushee/zoom/RusheeProfileHeader.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("./fixtures/rusheeZoomProfileHeader.json", import.meta.url));
const rushee = {
    image_url: "/photo.png", first_name: "Ada", last_name: "Example", pronouns: "she/her",
    email: "ada@example.com", major: "CS", class: "Junior", housing: "North", gtid: "123",
    attendance: [{ name: "Night 1" }, { name: "Night 2" }],
};
// The badge stub keeps the baseline markup independent of the shared component.
// eslint-disable-next-line react/prop-types
const Badges = ({ text }) => React.createElement("span", { "data-badge": text }, text);

test("normal and bid committee profile headers retain original rendered markup", async () => {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const RusheeProfileHeader = await loadTsxComponent(componentPath, {
        "../../../components/Badge": Badges,
    });
    for (const [name, bidMode] of Object.entries({ normal: false, bidCommittee: true })) {
        const html = renderToStaticMarkup(React.createElement(RusheeProfileHeader, {
            rushee,
            isBidCommitteeMode: () => bidMode,
            getRusheeNumber: () => "42",
        }));
        const hash = createHash("sha256").update(html).digest("hex");
        assert.equal(hash, expected[name], `${name} profile header changed`);
    }
});

test("bid committee number and privacy branches retain their existing checks", async () => {
    const RusheeProfileHeader = await loadTsxComponent(componentPath, {
        "../../../components/Badge": Badges,
    });
    const calls = [];
    renderToStaticMarkup(React.createElement(RusheeProfileHeader, {
        rushee,
        isBidCommitteeMode: () => { calls.push("mode"); return true; },
        getRusheeNumber: () => { calls.push("number"); return "42"; },
    }));
    assert.equal(calls.filter((call) => call === "mode").length, 5);
    assert.equal(calls.filter((call) => call === "number").length, 2);
});
