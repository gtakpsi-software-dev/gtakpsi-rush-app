import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL(
    "../../src/features/attendance/DisplayInfo.tsx", import.meta.url,
));

test("attendance confirmation keeps its profile and action markup", async () => {
    // Verify attendance confirmation keeps its profile and action markup.
    const DisplayInfo = await loadTsxComponent(componentPath);
    const html = renderToStaticMarkup(React.createElement(DisplayInfo, {
        rushee: {
            image_url: "headshot",
            first_name: "Ada",
            last_name: "Example",
            pronouns: "she/her",
            major: "Business",
            email: "ada@example.invalid",
            phone_number: "4045550100",
            housing: "Campus",
        },
        // Provide an inert go back stub for this test.
        goBack() {},
        // Provide an inert check in stub for this test.
        checkIn() {},
    }));

    assert.equal(
        createHash("sha256").update(html).digest("hex"),
        "0d8b8a46558ee6f05204d59add87990160c23d9d6d558e42b5f15146c201966e",
    );
    assert.match(html, /No\? Go Back/);
    assert.match(html, /Yes! Check In/);
});
