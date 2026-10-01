import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const hookPath = fileURLToPath(new URL(
    "../src/features/admin/availability/useAdminAvailabilityForm.js", import.meta.url,
));

test("availability form hook keeps lifecycle defaults and view/action boundaries", async () => {
    const initialValues = [];
    let actionOptions;
    const handleSendPISForm = () => {};
    const Hook = await loadTsxComponent(hookPath, {
        react: { useState(initialValue) {
            initialValues.push(initialValue);
            return [initialValue, () => {}];
        } },
        "./availabilityFormActions": { createAvailabilityFormActions(options) {
            actionOptions = options;
            return { handleSendPISForm };
        } },
    });
    const confirm = () => true;
    const axios = {};
    const toast = {};
    const result = Hook({ apiBase: "/api/admin", axios, toast, confirm });

    assert.equal(JSON.stringify(initialValues), JSON.stringify([
        { is_active: false, sent_at: null }, false, [],
    ]));
    assert.equal(actionOptions.apiBase, "/api/admin");
    assert.equal(actionOptions.setPisFormStatus, result.setPisFormStatus);
    assert.equal(actionOptions.setBrotherAvailabilities, result.setBrotherAvailabilities);
    assert.equal(actionOptions.confirm, confirm);
    assert.equal(actionOptions.axios, axios);
    assert.equal(actionOptions.toast, toast);
    assert.equal(result.view.handleSendPISForm, handleSendPISForm);
    assert.equal(result.view.pisFormLoading, false);
    assert.equal(Object.hasOwn(result.view, "setBrotherAvailabilities"), false);
});
