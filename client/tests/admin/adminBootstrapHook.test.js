import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const hookPath = fileURLToPath(new URL(
    "../../src/features/admin/bootstrap/useAdminBootstrap.js", import.meta.url,
));

test("admin bootstrap keeps its loading gate, inputs, and effect dependencies", async () => {
    // Verify admin bootstrap keeps its loading gate, inputs, and effect dependencies.
    const effects = [];
    const calls = [];
    // Provide an inert verify user stub for this test.
    const verifyUser = () => {};
    // Provide an inert navigate stub for this test.
    const navigate = () => {};
    const auth = {};
    const db = {};
    const axios = {};
    const toast = {};
    // Provide an inert collection stub for this test.
    const collection = () => {};
    // Provide an inert get docs stub for this test.
    const getDocs = () => {};
    const setters = Object.fromEntries([
        "setBrothers", "setRushees", "setAvailableTimeslots", "setPisFormStatus",
        "setBrotherAvailabilities", "setAllPisTimeslots", "setRushAppStatus",
        "setCommentVisibilityStatus", "setLoading",
    ].map(/* Return the fixture for this scenario. */ (name) => [name, /* Leave this mocked callback inert. */ () => {}]));
    const Hook = await loadTsxComponent(hookPath, {
        react: { useEffect(effect, dependencies) {
            // Capture effects so the test can run them explicitly.
            effects.push(Array.from(dependencies));
            effect();
        } },
        axios,
        "react-toastify": { toast },
        "firebase/firestore": { collection, getDocs },
        "../../auth/verifyUser": { verifyUser },
        "../../../firebase": { auth, db },
        "./loadAdminData": { loadAdminData: /* Record load admin data calls for assertions. */ (options) => calls.push(options) },
    });
    const options = {
        navigate,
        allowlist: ["admin@example.edu"],
        apiBase: "/api/admin",
        rusheeApiBase: "/api/rushee",
        ...setters,
    };

    Hook({ ...options, loading: false });
    assert.equal(calls.length, 0);
    Hook({ ...options, loading: true });
    assert.equal(calls.length, 1);
    Hook({ ...options, allowlist: ["other@example.edu"], loading: true });
    assert.deepEqual(effects, [
        [false, navigate, "/api/rushee"],
        [true, navigate, "/api/rushee"],
        [true, navigate, "/api/rushee"],
    ]);
    assert.equal(calls[0].verifyUser, verifyUser);
    assert.equal(calls[0].auth, auth);
    assert.equal(calls[0].db, db);
    assert.equal(calls[0].axios, axios);
    assert.equal(calls[0].toast, toast);
    assert.equal(calls[0].collection, collection);
    assert.equal(calls[0].getDocs, getDocs);
    assert.equal(calls[0].allowlist, options.allowlist);
    assert.equal(calls[0].errorTitle, "Invalid User Credentials");
    assert.equal(calls[0].errorDescription, "If this is a mistake, try logging back in");
    for (const [name, setter] of Object.entries(setters)) {
        assert.equal(calls[0][name], setter);
    }
});
