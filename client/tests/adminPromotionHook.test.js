import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const hookPath = fileURLToPath(new URL(
    "../src/features/admin/access/useAdminPromotion.js", import.meta.url,
));

test("promotion hook passes its four state setters to the existing actions", async () => {
    const initialValues = [];
    let actionOptions;
    const handleSelectBrother = () => {};
    const Hook = await loadTsxComponent(hookPath, {
        react: { useState(initialValue) {
            initialValues.push(initialValue);
            return [initialValue, () => {}];
        } },
        "./promotionActions": { createPromotionActions(options) {
            actionOptions = options;
            return { handleSelectBrother };
        } },
    });
    const setBrotherSearch = () => {};
    const setFilteredBrothers = () => {};
    const axios = {};
    const toast = {};
    const result = Hook({
        apiBase: "/api/admin", setBrotherSearch, setFilteredBrothers, axios, toast,
    });

    assert.equal(JSON.stringify(initialValues), JSON.stringify([null, false, null, null]));
    assert.equal(actionOptions.selectedBrother, null);
    assert.equal(actionOptions.setSelectedBrother, result.setSelectedBrother);
    assert.equal(actionOptions.setBrotherSearch, setBrotherSearch);
    assert.equal(actionOptions.setFilteredBrothers, setFilteredBrothers);
    assert.equal(actionOptions.apiBase, "/api/admin");
    assert.equal(actionOptions.axios, axios);
    assert.equal(actionOptions.toast, toast);
    assert.equal(result.handleSelectBrother, handleSelectBrother);
});
