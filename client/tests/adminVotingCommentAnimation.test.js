import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";

import React from "react";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL(
    "../src/pages/AdminVotingDashboard/RusheeComments.tsx",
    import.meta.url,
));

async function renderComments(rushee) {
    const effects = [];
    const animations = [];
    const RusheeComments = await loadTsxComponent(componentPath, {
        react: {
            ...React,
            useRef: (initial) => ({ current: initial }),
            useEffect: (callback, dependencies) => effects.push({ callback, dependencies }),
        },
        "./AdminVotingContext": { useAdminVotingContext: () => ({ rushee }) },
        "../../components/Badge": () => null,
        gsap: { fromTo: (...args) => animations.push(args) },
        "../../features/comments/ratingDisplay": { formatRatingValue: String },
    });

    RusheeComments();
    effects[0].callback();
    return { effects, animations };
}

test("admin comment animation tracks the comments array and skips empty selections", async () => {
    const comments = [{ brother_name: "Sam", comment: "Met", ratings: [] }];
    const active = await renderComments({ comments });
    assert.equal(active.effects.length, 1);
    assert.equal(active.effects[0].dependencies[0], comments);
    assert.equal(active.animations.length, 1);
    assert.equal(active.animations[0][1].y, -20);
    assert.equal(active.animations[0][1].opacity, 0);
    assert.equal(active.animations[0][2].duration, 0.4);
    assert.equal(active.animations[0][2].stagger, 0.08);

    assert.equal((await renderComments({ comments: [] })).animations.length, 0);
    assert.equal((await renderComments(null)).animations.length, 0);
});
