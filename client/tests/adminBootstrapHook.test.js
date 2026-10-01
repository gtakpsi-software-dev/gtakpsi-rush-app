import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const hookPath = fileURLToPath(new URL(
    "../src/features/admin/bootstrap/useAdminBootstrap.js", import.meta.url,
));

test("admin bootstrap keeps its loading gate, inputs, and effect dependencies", async () => {
    const effects = [];
    const calls = [];
    const verifyUser = () => {};
    const navigate = () => {};
    const auth = {};
    const db = {};
    const axios = {};
    const toast = {};
    const collection = () => {};
    const getDocs = () => {};
    const setters = Object.fromEntries([
        "setBrothers", "setRushees", "setAvailableTimeslots", "setPisFormStatus",
        "setBrotherAvailabilities", "setAllPisTimeslots", "setRushAppStatus",
        "setCommentVisibilityStatus", "setLoading",
    ].map((name) => [name, () => {}]));
    const Hook = await loadTsxComponent(hookPath, {
        react: { useEffect(effect, dependencies) {
            effects.push(Array.from(dependencies));
            effect();
        } },
        axios,
        "react-toastify": { toast },
        "firebase/firestore": { collection, getDocs },
        "../../auth/verifyUser": { verifyUser },
        "../../../firebase": { auth, db },
        "./loadAdminData": { loadAdminData: (options) => calls.push(options) },
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
    assert.deepEqual(effects, [
        [false, navigate, "/api/rushee"],
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
