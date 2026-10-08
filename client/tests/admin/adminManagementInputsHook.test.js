import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const hookPath = fileURLToPath(new URL(
    "../../src/features/admin/overview/useAdminManagementInputs.js", import.meta.url,
));

test("management inputs keep their initial values and one question fetch effect", async () => {
    // Verify management inputs keep their initial values and one question fetch effect.
    const initialValues = [];
    const events = [];
    let actionOptions;
    // Record fetch pis questions calls for assertions.
    const fetchPisQuestions = () => events.push("fetch");
    // Provide an inert save question category stub for this test.
    const saveQuestionCategory = () => {};
    const Hook = await loadTsxComponent(hookPath, {
        react: {
            // Supply controlled state and a setter without mounting React.
            useState(initialValue) {
                initialValues.push(initialValue);
                return [initialValue, /* Leave this mocked callback inert. */ () => {}];
            },
            // Capture effects so the test can run them explicitly.
            useEffect(effect, dependencies) {
                events.push(["effect", Array.from(dependencies)]);
                effect();
            },
            // Provide a mutable ref without mounting a React component.
            useRef: (initialValue) => ({ current: initialValue }),
        },
        "../pis/questionActions": {
            // Capture action dependencies and return the question handlers.
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

test("management inputs use the initial fetch for the mount effect across rerenders", async () => {
    // Verify management inputs use the initial fetch for the mount effect across rerenders.
    const calls = [];
    let mountEffect;
    let render = 0;
    let stateIndex = 0;
    let ref;
    // Record initial fetch calls for assertions.
    const initialFetch = () => calls.push("initial fetch");
    // Record updated fetch calls for assertions.
    const updatedFetch = () => calls.push("updated fetch");
    const Hook = await loadTsxComponent(hookPath, {
        react: {
            // Supply controlled state and a setter without mounting React.
            useState(initialValue) {
                const index = stateIndex++;
                return [render === 1 && index === 6 ? { edited: "notes" } : initialValue, /* Leave this mocked callback inert. */ () => {}];
            },
            // Provide a mutable ref without mounting a React component.
            useRef(initialValue) {
                if (!ref) ref = { current: initialValue };
                return ref;
            },
            // Verify mount-only dependencies and retain the first effect.
            useEffect(effect, dependencies) {
                assert.deepEqual(Array.from(dependencies), []);
                if (!mountEffect) mountEffect = effect;
            },
        },
        "../pis/questionActions": {
            // Return the create question actions fixture for this scenario.
            createQuestionActions() {
                return {
                    fetchPisQuestions: render === 0 ? initialFetch : updatedFetch,
                    // Provide an inert save question category stub for this test.
                    saveQuestionCategory: () => {},
                };
            },
        },
    });

    Hook({ apiBase: "/api/admin", axios: {}, toast: {} });
    render = 1;
    stateIndex = 0;
    const latest = Hook({ apiBase: "/api/admin", axios: {}, toast: {} });
    mountEffect();

    assert.deepEqual(calls, ["initial fetch"]);
    assert.equal(latest.fetchPisQuestions, updatedFetch);
});
