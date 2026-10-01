import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithEsbuild } from "vite";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const pagePath = fileURLToPath(new URL("../src/pages/PIS.jsx", import.meta.url));
const cardPath = fileURLToPath(new URL("../src/features/pis/PisQuestionsCard.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("./fixtures/pisPageMarkup.json", import.meta.url));

async function loadPage(state = {}, connected = true, captured = new Map()) {
    const stub = (name) => function Stub(props) {
        captured.set(name, props);
        return React.createElement("span", { "data-stub": name });
    };
    const Card = await loadTsxComponent(cardPath, {
        "./PisBrotherFields": stub("brother-fields"),
        "./PisQuestionResponses": stub("question-responses"),
        "./PisSaveStatus": stub("save-status"),
    });
    let stateIndex = 0;
    const noop = () => {};
    const dependencies = {
        react: {
            ...React,
            useState(initial) {
                const index = stateIndex++;
                return [Object.hasOwn(state, index) ? state[index] : initial, noop];
            },
            useEffect: noop,
            useRef: (initial) => ({ current: initial }),
            useCallback: (callback) => callback,
        },
        "../components/Loader": stub("loader"),
        "../components/Navbar": stub("navbar"),
        axios: { get: noop },
        "../hooks/useCollaboration": {
            useCollaboration: () => {
                const collaboration = {
                    isConnected: connected,
                    connectedUsers: connected ? [{}, {}] : [],
                    requestDocumentState: noop,
                    documentState: null,
                    remoteUpdates: [],
                };
                captured.set("collaboration", collaboration);
                return collaboration;
            },
        },
        "../features/auth/verifyUser": { verifyUser: noop },
        "react-router-dom": { useNavigate: () => noop, useParams: () => ({ gtid: "123" }) },
        "../firebase": { auth: {} },
        "react-toastify/dist/ReactToastify.css": {},
        "../features/pis/PisProfileHeader": stub("profile"),
        "../features/pis/PisBrotherFields": stub("brother-fields"),
        "../features/pis/PisQuestionResponses": stub("question-responses"),
        "../features/pis/PisSaveStatus": stub("save-status"),
        "../features/pis/PisQuestionsCard": Card,
        "../features/pis/PisQuestionsPending": stub("pending"),
        "../features/pis/saveStatus": { SAVE_STATUS: { IDLE: "idle" } },
        "../features/pis/collaborationState": {
            applyDocumentState: noop, applyRemoteUpdates: noop,
        },
        "../features/pis/performPisAutosave": { performPisAutosave: noop },
        "../features/pis/loadPisPageData": { loadPisPageData: noop },
        "../features/pis/startPisRevealPolling": { startPisRevealPolling: noop },
        "../features/pis/createPisAnswerHandlers": {
            createPisAnswerHandlers: () => ({ handleAnswerChange: noop, handleMCChange: noop }),
        },
    };
    const source = (await readFile(pagePath, "utf8"))
        .replaceAll("import.meta.env.VITE_API_PREFIX", '"/api"');
    const { code } = await transformWithEsbuild(source, pagePath, {
        loader: "jsx", format: "cjs", jsx: "automatic",
    });
    const module = { exports: {} };
    const requireFromPage = createRequire(pagePath);

    runInNewContext(code, {
        module,
        exports: module.exports,
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromPage(specifier);
        },
    }, { filename: pagePath });

    return module.exports.default;
}

test("PIS page retains its loading, pending, online, and offline markup", async () => {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const scenarios = {
        loading: [{}, true],
        pending: [{ 0: false, 3: false }, true],
        online: [{ 0: false }, true],
        offline: [{ 0: false }, false],
    };
    const actual = {};

    for (const [name, [state, connected]] of Object.entries(scenarios)) {
        const Page = await loadPage(state, connected);
        const html = renderToStaticMarkup(React.createElement(Page));
        actual[name] = createHash("sha256").update(html).digest("hex");
    }
    assert.deepEqual(actual, expected);
});

test("PIS questions retain answer, brother, collaboration, and save props", async () => {
    const captured = new Map();
    const rushee = { first_name: "Ada" };
    const questions = [{ id: "q1" }];
    const answers = { q1: "Answer" };
    const brotherA = { firstName: "One" };
    const brotherB = { firstName: "Two" };
    const user = { name: "Brother" };
    const Page = await loadPage({
        0: false, 1: rushee, 2: questions, 5: answers,
        6: brotherA, 7: brotherB, 8: user, 9: "saving", 10: 123,
    }, true, captured);
    renderToStaticMarkup(React.createElement(Page));

    assert.equal(captured.get("brother-fields").rushee, rushee);
    assert.equal(captured.get("brother-fields").brotherA, brotherA);
    assert.equal(captured.get("brother-fields").brotherB, brotherB);
    assert.equal(captured.get("brother-fields").currentUser, user);
    assert.equal(captured.get("brother-fields").collaboration, captured.get("collaboration"));
    assert.equal(captured.get("question-responses").questions, questions);
    assert.equal(captured.get("question-responses").answers, answers);
    assert.equal(captured.get("question-responses").currentUser, user);
    assert.equal(captured.get("question-responses").collaboration, captured.get("collaboration"));
    assert.equal(typeof captured.get("question-responses").handleMCChange, "function");
    assert.equal(typeof captured.get("question-responses").handleAnswerChange, "function");
    assert.equal(captured.get("save-status").saveStatus, "saving");
    assert.equal(captured.get("save-status").lastSaved, 123);
});
