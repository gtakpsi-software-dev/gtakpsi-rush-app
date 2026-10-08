import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../../src/features/pis/PisProfileHeader.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../fixtures/pisProfileHeader.json", import.meta.url));
const rushee = {
    image_url: "/photo.png", first_name: "Ada", last_name: "Example",
    pronouns: "she/her", major: "CS", email: "ada@example.com",
    phone_number: "1234567890", housing: "North", gtid: "123",
    attendance: [{ name: "Night 1" }, { name: "Night 2" }],
};

// Keep the badge stub independent of the shared component while comparing page markup.
// eslint-disable-next-line react/prop-types
// Render a lightweight React element for component assertions.
const Badges = ({ text }) => React.createElement("span", { "data-badge": text }, text);

test("PIS profile header retains attendee and no-attendance markup", async () => {
    // Verify PIS profile header retains attendee and no-attendance markup.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const PisProfileHeader = await loadTsxComponent(componentPath, {
        "../../components/Badge": Badges,
    });
    for (const [name, attendance] of Object.entries({
        attended: rushee.attendance,
        noAttendance: [],
    })) {
        const html = renderToStaticMarkup(React.createElement(PisProfileHeader, {
            rushee: { ...rushee, attendance },
        }));
        assert.equal(createHash("sha256").update(html).digest("hex"), expected[name]);
    }
});
