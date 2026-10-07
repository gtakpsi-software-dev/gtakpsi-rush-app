import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";

import React from "react";
import { transformWithEsbuild } from "vite";

const componentPath = fileURLToPath(new URL(
    "../../../src/features/voting/brother/RusheeComments.tsx",
    import.meta.url,
));

async function renderComments(rushee) {
    const effects = [];
    const animations = [];
    const source = await readFile(componentPath, "utf8");
    const compiled = await transformWithEsbuild(source, componentPath, {
        loader: "tsx", format: "cjs", jsx: "automatic",
    });
    const module = { exports: {} };
    const requireFromComponent = createRequire(componentPath);
    const dependencies = {
        react: {
            ...React,
            useRef: (initial) => ({ current: initial }),
            useState: (initial) => [initial, () => {}],
            useEffect: (callback, values) => effects.push({ callback, values }),
        },
        "./BrotherVotingContext": { useBrotherVotingContext: () => ({ rushee }) },
        "../../../components/Badge": () => null,
        gsap: { fromTo: (...args) => animations.push(args) },
        "../../comments/ratingDisplay": {
            formatRatingValue: String,
            ratingBadgeClass: () => "",
        },
        "../../comments/commentVisibility": {
            getVisibleComments: (comments) => comments,
            shouldShowAllComments: () => true,
        },
        axios: {},
        "../../../firebase": { auth: { currentUser: null } },
    };

    runInNewContext(compiled.code, {
        module,
        exports: module.exports,
        localStorage: { getItem: () => null },
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromComponent(specifier);
        },
    }, { filename: componentPath });

    module.exports.default();
    effects[1].callback();
    return { effects, animations };
}

test("brother comment animation tracks visible comments and skips empty selections", async () => {
    const comments = [{ brother_name: "Sam", comment: "Met", ratings: [] }];
    const active = await renderComments({ comments });
    assert.equal(active.effects.length, 2);
    assert.equal(active.effects[1].values[0], comments);
    assert.equal(active.effects[1].values[1], 1);
    assert.equal(active.animations.length, 1);
    assert.equal(active.animations[0][1].y, -20);
    assert.equal(active.animations[0][2].duration, 0.4);

    assert.equal((await renderComments({ comments: [] })).animations.length, 0);
    assert.equal((await renderComments(null)).animations.length, 0);
});
