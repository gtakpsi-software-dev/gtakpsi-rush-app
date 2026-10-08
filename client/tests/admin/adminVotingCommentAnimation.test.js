import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";

import React from "react";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL(
    "../../src/features/voting/admin/RusheeComments.tsx",
    import.meta.url,
));

// Render comments with controlled effects and capture the resulting animation.
async function renderComments(rushee) {
    const effects = [];
    const animations = [];
    const RusheeComments = await loadTsxComponent(componentPath, {
        react: {
            ...React,
            // Provide a mutable ref without mounting a React component.
            useRef: (initial) => ({ current: initial }),
            // Capture effects so the test can run them explicitly.
            useEffect: (callback, dependencies) => effects.push({ callback, dependencies }),
        },
        "./AdminVotingContext": { useAdminVotingContext: /* Return the use admin voting context fixture for this scenario. */ () => ({ rushee }) },
        // Return null from this dependency stub.
        "../../../components/Badge": () => null,
        gsap: { fromTo: /* Record from to calls for assertions. */ (...args) => animations.push(args) },
        "../../comments/ratingDisplay": { formatRatingValue: String },
    });

    RusheeComments();
    effects[0].callback();
    return { effects, animations };
}

test("admin comment animation tracks the comments array and skips empty selections", async () => {
    // Verify admin comment animation tracks the comments array and skips empty selections.
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
