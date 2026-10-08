import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SAVE_STATUS } from "../../../src/features/pis/saveStatus.js";
import { loadTsxComponent } from "../../helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../../../src/features/pis/PisSaveStatus.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../../fixtures/pisSaveStatus.json", import.meta.url));

test("PIS save states retain the original status markup", async () => {
    // Verify PIS save states retain the original status markup.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const PisSaveStatus = await loadTsxComponent(componentPath, { "./saveStatus": { SAVE_STATUS } });
    let timeCalls = 0;
    const scenarios = {
        saving: { saveStatus: SAVE_STATUS.SAVING, lastSaved: null },
        saved: { saveStatus: SAVE_STATUS.SAVED, lastSaved: null },
        error: { saveStatus: SAVE_STATUS.ERROR, lastSaved: null },
        idle: { saveStatus: SAVE_STATUS.IDLE, lastSaved: null },
        idleAfterSave: {
            saveStatus: SAVE_STATUS.IDLE,
            lastSaved: { toLocaleTimeString: () => {
                // Count time formatting calls and return a fixed display time.
                 timeCalls += 1; return "10:30:00 AM"; } },
        },
    };
    for (const [name, props] of Object.entries(scenarios)) {
        const html = renderToStaticMarkup(React.createElement(PisSaveStatus, props));
        assert.equal(createHash("sha256").update(html).digest("hex"), expected[name]);
    }
    assert.equal(timeCalls, 1);
});
