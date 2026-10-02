import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const previewPath = fileURLToPath(new URL(
    "../src/features/voting/brother/RusheePreviewCard.tsx", import.meta.url,
));
const pisPath = fileURLToPath(new URL(
    "../src/features/voting/brother/RusheePISInfo.tsx", import.meta.url,
));

const rushee = {
    first_name: "Ada", last_name: "Example", gtid: "123", image_url: "/photo.png",
    major: "Business", pronouns: "they/them", interactions_by_night: [],
    attendance: [], comments: [],
};

async function renderView(path, selectedRushee, props = {}) {
    const View = await loadTsxComponent(path, {
        "./BrotherVotingContext": {
            useBrotherVotingContext: () => ({ rushee: selectedRushee }),
        },
        "../../../components/RusheeInteractionsByNight": () => (
            React.createElement("span", { "data-stub": "interactions" })
        ),
    });
    return renderToStaticMarkup(React.createElement(View, props));
}

test("brother voting preview and PIS detail states retain their exact markup", async () => {
    const scenarios = {
        waiting: await renderView(previewPath, null),
        regular: await renderView(previewPath, rushee),
        midterm: await renderView(previewPath, rushee, { midtermMode: true }),
        missingPis: await renderView(pisPath, null),
        emptyPis: await renderView(pisPath, { ...rushee, pis: [] }),
        answeredPis: await renderView(pisPath, { ...rushee, pis: [
            { question: "Why?", answer: "Because." },
            { question: "When?", answer: "" },
        ] }),
    };
    const hashes = Object.fromEntries(Object.entries(scenarios).map(([name, html]) => [
        name, createHash("sha256").update(html).digest("hex"),
    ]));

    assert.deepEqual(hashes, {
        waiting: "d78f875248c3481dc8eee4210fe89724fdb311e186769b6409e158099a86ec5c",
        regular: "1c5fe943cefa6debf7c4faa9a6fa132cdc12e8ad7e456122fbf2d1a27e5aa3bb",
        midterm: "2ef75114e092df5ab168eeb92fe96c164c0288a19be4d3d7a3fc8ecc8b9cf337",
        missingPis: "ac28418611b76c5ec92ce6df8f29bf30f69a877a878cba2307a8860b2f84153d",
        emptyPis: "c43ad2c2a2900807913bde7fb6ce896bf0c83d74a97a88d7cf3245cd1d17a3e9",
        answeredPis: "6fa56474db516b186266d8acad3550a2a84b5c843d42891ba7816befb108d6a3",
    });
});
