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
import { loadTsxComponent } from "../../helpers/loadTsxComponent.js";

const pagePath = fileURLToPath(new URL("../../../src/pages/RusheePage.jsx", import.meta.url));
const viewPath = fileURLToPath(new URL("../../../src/features/rushee/self/RusheeSelfPageView.tsx", import.meta.url));
const summaryPath = fileURLToPath(new URL("../../../src/features/rushee/self/RusheeProfileSummary.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../../fixtures/rusheeSelfPageMarkup.json", import.meta.url));

const rushee = {
    first_name: "Ada", last_name: "Example", image_url: "/ada.jpg",
    attendance: [{ name: "Rush Night" }], pronouns: "she/her",
    major: "Computing", email: "ada@example.edu", phone_number: "555-0100",
    housing: "Campus", pis_timeslot: { $date: { $numberLong: "123456789" } },
};

// Load page with injected dependencies for isolated tests.
async function loadPage(state = {}, captured = new Map()) {
    // Create a lightweight component that captures props for assertions.
    const stub = (name) => function Stub(props) {
        // Capture component props and render a placeholder element.
        captured.set(name, props);
        return React.createElement("span", { "data-stub": name });
    };
    const Summary = await loadTsxComponent(summaryPath, {
        "../../../components/Badge": stub("badge"),
        "react-icons/fa": { FaRegEdit: stub("edit-icon") },
    });
    // Capture summary props before rendering the real component.
    const SummaryWithCapture = (props) => {
        captured.set("summary", props);
        return React.createElement(Summary, props);
    };
    const View = await loadTsxComponent(viewPath, {
        "../../../components/Navbar": stub("navbar"),
        "../../../components/Loader": stub("loader"),
        "./RusheePhotoModal": stub("photo-modal"),
        "./RusheeProfileForm": stub("profile-form"),
        "./RusheeProfileSummary": SummaryWithCapture,
    });
    let stateIndex = 0;
    // Supply an inert callback where this test does not exercise the handler.
    const noop = () => {};
    const dependencies = {
        react: {
            ...React,
            // Expose controlled hook state and capture updates for assertions.
            useState(initial) {
                const index = stateIndex++;
                // Invoke captured.set with the test inputs.
                const setter = (value) => captured.set(`state-${index}`, value);
                return [Object.hasOwn(state, index) ? state[index] : initial, setter];
            },
            useEffect: noop,
            // Provide a mutable ref without mounting a React component.
            useRef: () => ({ current: null }),
        },
        "react-router-dom": { useNavigate:
            /* Provide an inert handler for the test. */
            () => noop, useParams:
            /* Return the route-parameter fixture for this scenario. */
            () => ({ gtid: "123", link: "code" }) },
        "../components/Badge": stub("badge"),
        axios: { get: noop, post: noop },
        "react-toastify": { toast: {} },
        "react-toastify/dist/ReactToastify.css": {},
        "react-icons/fa": { FaRegEdit: stub("edit-icon") },
        "../firebase": { storage: {} },
        "firebase/storage": { ref: noop, uploadBytes: noop, getDownloadURL: noop },
        "../lib/imageProcessing": { base64ToBlob: noop },
        "../features/registration/registrationVerification": { verifyInfo: noop },
        "../features/rushee/self/submitProfileChanges": { submitProfileChanges: noop },
        "../features/rushee/self/submitRusheePhoto": { submitRusheePhoto: noop },
        "../features/rushee/self/RusheeSelfPageView": View,
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
        Date: class extends Date {
            // Return the fixed to locale string fixture.
            toLocaleString() { return "Scheduled Time"; }
        },
        // Resolve injected test dependencies before falling back to real modules.
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromPage(specifier);
        },
    }, { filename: pagePath });

    return module.exports.default;
}

test("self-profile page retains loading, ready, and photo-modal markup", async () => {
    // Verify self-profile page retains loading, ready, and photo-modal markup.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const scenarios = {
        loading: {},
        ready: { 0: rushee, 1: rushee, 2: false },
        modal: { 0: rushee, 1: rushee, 2: false, 3: true },
    };
    const actual = {};

    for (const [name, state] of Object.entries(scenarios)) {
        const Page = await loadPage(state);
        const html = renderToStaticMarkup(React.createElement(Page));
        actual[name] = createHash("sha256").update(html).digest("hex");
    }
    assert.deepEqual(actual, expected);
});

test("self-profile summary receives the fetched profile and opens photo editing", async () => {
    // Verify self-profile summary receives the fetched profile and opens photo editing.
    const captured = new Map();
    const Page = await loadPage({ 0: rushee, 1: rushee, 2: false }, captured);
    renderToStaticMarkup(React.createElement(Page));

    const summary = captured.get("summary");
    assert.equal(summary.initialRushee, rushee);
    assert.equal(captured.get("badge").text, "Rush Night");
    summary.onEditImage();
    assert.equal(captured.get("state-3"), true);
});

test("photo modal retains close and retake state updates", async () => {
    // Verify photo modal retains close and retake state updates.
    const captured = new Map();
    const Page = await loadPage({
        0: rushee, 1: rushee, 2: false, 3: true, 4: true, 5: "preview",
    }, captured);
    renderToStaticMarkup(React.createElement(Page));

    const modal = captured.get("photo-modal");
    assert.equal(modal.showPreview, true);
    assert.equal(modal.image, "preview");
    modal.onRetake();
    assert.equal(captured.get("state-4"), false);
    modal.onClose();
    assert.equal(captured.get("state-3"), false);
    assert.equal(captured.get("state-4"), false);
    assert.equal(captured.get("state-5"), null);
});
