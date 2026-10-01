import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";
import {
    computeInteractionsByNight,
    formatNightInteractionLine,
} from "../src/features/rushee/interactions.js";

const componentPath = fileURLToPath(new URL(
    "../src/components/RusheeInteractionsByNight.tsx", import.meta.url,
));

test("interaction summaries keep regular, compact, and empty markup", async () => {
    const Component = await loadTsxComponent(componentPath, {
        react: React,
        axios: {},
        "../features/rushee/interactions": { computeInteractionsByNight, formatNightInteractionLine },
    });
    const scenarios = [
        {
            props: { nights: [
                { name: "Night 1", night_index: 1, interactions: 2 },
                { name: "Night 2", night_index: 2, interactions: null },
            ] },
            hash: "0e90326e218c44c73fcfc671cd6d6a33b4241ac759096798988e733f1a6f50b7",
        },
        {
            props: {
                nights: [{ name: "Night 1", night_index: 1, interactions: 2 }],
                compact: true,
                className: "mb-2",
            },
            hash: "85b8ea33af3c599a468a2cba027686740e166e184558da43e9d20188a1ad3f85",
        },
        { props: {}, hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
    ];

    for (const { props, hash } of scenarios) {
        const html = renderToStaticMarkup(React.createElement(Component, props));
        assert.equal(createHash("sha256").update(html).digest("hex"), hash);
    }
});
