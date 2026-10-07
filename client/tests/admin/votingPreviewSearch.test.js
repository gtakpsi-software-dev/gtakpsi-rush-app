import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { transformWithEsbuild } from "vite";

const helperPath = fileURLToPath(new URL(
    "../../src/features/voting/admin/previewRusheeSearch.ts",
    import.meta.url,
));

async function loadHelpers() {
    const source = await readFile(helperPath, "utf8");
    const { code } = await transformWithEsbuild(source, helperPath, {
        loader: "ts", format: "cjs",
    });
    const module = { exports: {} };
    runInNewContext(code, { module, exports: module.exports }, { filename: helperPath });
    return module.exports;
}

test("voting preview search retains name fallbacks, GTID matching, and raw query spacing", async () => {
    const { filterPreviewRushees } = await loadHelpers();
    const rushees = [
        { first_name: "Ada", last_name: "Lovelace", gtid: "1" },
        { firstname: "Grace", lastname: "Hopper", gtid: "2" },
        { name: "Alan Turing", gtid: "3" },
    ];

    assert.equal(filterPreviewRushees(null, "ada"), null);
    assert.equal(filterPreviewRushees(rushees, "   "), rushees);
    assert.deepEqual(Array.from(filterPreviewRushees(rushees, "aDa")), [rushees[0]]);
    assert.deepEqual(Array.from(filterPreviewRushees(rushees, "grace hopper")), [rushees[1]]);
    assert.deepEqual(Array.from(filterPreviewRushees(rushees, "TURING")), [rushees[2]]);
    assert.deepEqual(Array.from(filterPreviewRushees(rushees, "2")), [rushees[1]]);
    assert.deepEqual(Array.from(filterPreviewRushees(rushees, " Ada")), []);
});

test("voting preview labels retain primary, legacy, and unknown name fallbacks", async () => {
    const { previewRusheeName } = await loadHelpers();

    assert.equal(previewRusheeName({ first_name: "Ada", last_name: "Lovelace" }), "Ada Lovelace");
    assert.equal(previewRusheeName({ name: "Grace Hopper" }), "Grace Hopper");
    assert.equal(previewRusheeName({ firstname: "Alan", lastname: "Turing" }), "Alan Turing");
    assert.equal(previewRusheeName({}), "Unknown Name");
});
