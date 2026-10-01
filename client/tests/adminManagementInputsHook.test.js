import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const hookPath = fileURLToPath(new URL(
    "../src/features/admin/overview/useAdminManagementInputs.js", import.meta.url,
));

test("management inputs keep their initial values and one question fetch effect", async () => {
    const initialValues = [];
    const events = [];
    let actionOptions;
    const fetchPisQuestions = () => events.push("fetch");
    const saveQuestionCategory = () => {};
    const Hook = await loadTsxComponent(hookPath, {
        react: {
            useState(initialValue) {
                initialValues.push(initialValue);
                return [initialValue, () => {}];
            },
            useEffect(effect, dependencies) {
                events.push(["effect", Array.from(dependencies)]);
                effect();
            },
        },
        "../pis/questionActions": {
            createQuestionActions(options) {
                events.push("create actions");
                actionOptions = options;
                return { fetchPisQuestions, saveQuestionCategory };
            },
        },
    });
    const axios = {};
    const toast = {};
    const result = Hook({ apiBase: "/api/admin", axios, toast });

    assert.equal(JSON.stringify(initialValues), JSON.stringify([
        "", "", "", "", [], false, {}, "", 1, "", "",
    ]));
    assert.deepEqual(events, ["create actions", ["effect", []], "fetch"]);
    assert.equal(actionOptions.apiBase, "/api/admin");
    assert.equal(actionOptions.axios, axios);
    assert.equal(actionOptions.toast, toast);
    assert.equal(result.fetchPisQuestions, fetchPisQuestions);
    assert.equal(result.saveQuestionCategory, saveQuestionCategory);
    assert.equal(result.timeslotChange, 1);
});
