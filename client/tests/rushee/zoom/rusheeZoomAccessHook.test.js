import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { getVisibleComments, hasOwnComment, shouldShowAllComments } from "../../../src/features/comments/commentVisibility.js";
import { loadTsxComponent } from "../../helpers/loadTsxComponent.js";

const hookPath = fileURLToPath(new URL("../../../src/features/rushee/zoom/useRusheeZoomAccess.js", import.meta.url));

test("Rushee Zoom access stays restricted while loading and forwards the original fetch dependencies", async () => {
    const effects = [];
    const requests = [];
    const auth = {};
    const axios = {};
    const verifyUser = () => {};
    const setters = {
        setRushee: () => {},
        setError: () => {},
        setLoading: () => {},
    };
    const hook = await loadTsxComponent(hookPath, {
        react: {
            useState: (initial) => [initial, () => {}],
            useEffect: (effect) => effects.push(effect),
        },
        axios,
        "../../../firebase": { auth },
        "../../comments/commentVisibility": {
            getVisibleComments, hasOwnComment, shouldShowAllComments,
        },
        "../../auth/verifyUser": { verifyUser },
        "./loadRusheeZoom": { loadRusheeZoom: (deps) => { requests.push(deps); } },
    });
    const args = {
        loading: true,
        navigate: () => {},
        errorTitle: "title",
        errorDescription: "description",
        api: "/api",
        gtid: "123",
        rushee: null,
        user: null,
        ...setters,
    };

    const access = hook(args);
    assert.equal(access.requireCommentToView, true);
    assert.equal(access.showAllComments, false);
    assert.equal(access.userHasOwnComment, false);
    assert.equal(access.visibleComments.length, 0);

    effects[0]();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].auth, auth);
    assert.equal(requests[0].axios, axios);
    assert.equal(requests[0].verifyUser, verifyUser);
    assert.equal(requests[0].setRushee, setters.setRushee);
    assert.equal(requests[0].setError, setters.setError);
    assert.equal(requests[0].setLoading, setters.setLoading);
    assert.equal(requests[0].gtid, "123");

    hook({ ...args, loading: false });
    effects[1]();
    assert.equal(requests.length, 1);
});
