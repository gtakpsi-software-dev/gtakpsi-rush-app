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

const pagePath = fileURLToPath(new URL("../src/pages/RusheePage.jsx", import.meta.url));
const summaryPath = fileURLToPath(new URL("../src/features/rushee/self/RusheeProfileSummary.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("./fixtures/rusheeSelfPageMarkup.json", import.meta.url));

const rushee = {
    first_name: "Ada", last_name: "Example", image_url: "/ada.jpg",
    attendance: [{ name: "Rush Night" }], pronouns: "she/her",
    major: "Computing", email: "ada@example.edu", phone_number: "555-0100",
    housing: "Campus", pis_timeslot: { $date: { $numberLong: "123456789" } },
};

async function loadPage(state = {}, captured = new Map()) {
    const stub = (name) => function Stub(props) {
        captured.set(name, props);
        return React.createElement("span", { "data-stub": name });
    };
    const Summary = await loadTsxComponent(summaryPath, {
        "../../../components/Badge": stub("badge"),
        "react-icons/fa": { FaRegEdit: stub("edit-icon") },
    });
    const SummaryWithCapture = (props) => {
        captured.set("summary", props);
        return React.createElement(Summary, props);
    };
    let stateIndex = 0;
    const noop = () => {};
    const dependencies = {
        react: {
            ...React,
            useState(initial) {
                const index = stateIndex++;
                const setter = (value) => captured.set(`state-${index}`, value);
                return [Object.hasOwn(state, index) ? state[index] : initial, setter];
            },
            useEffect: noop,
            useRef: () => ({ current: null }),
        },
        "react-router-dom": { useNavigate: () => noop, useParams: () => ({ gtid: "123", link: "code" }) },
        "../components/Loader": stub("loader"),
        "../components/Badge": stub("badge"),
        axios: { get: noop, post: noop },
        "../components/Navbar": stub("navbar"),
        "react-toastify": { toast: {} },
        "react-toastify/dist/ReactToastify.css": {},
        "react-icons/fa": { FaRegEdit: stub("edit-icon") },
        "../firebase": { storage: {} },
        "firebase/storage": { ref: noop, uploadBytes: noop, getDownloadURL: noop },
        "../js/image_processing": { base64ToBlob: noop },
        "../features/registration/registrationVerification": { verifyInfo: noop },
        "../features/rushee/self/submitProfileChanges": { submitProfileChanges: noop },
        "../features/rushee/self/submitRusheePhoto": { submitRusheePhoto: noop },
        "../features/rushee/self/RusheePhotoModal": stub("photo-modal"),
        "../features/rushee/self/RusheeProfileForm": stub("profile-form"),
        "../features/rushee/self/RusheeProfileSummary": SummaryWithCapture,
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
            toLocaleString() { return "Scheduled Time"; }
        },
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromPage(specifier);
        },
    }, { filename: pagePath });

    return module.exports.default;
}

test("self-profile page retains loading, ready, and photo-modal markup", async () => {
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
    const captured = new Map();
    const Page = await loadPage({ 0: rushee, 1: rushee, 2: false }, captured);
    renderToStaticMarkup(React.createElement(Page));

    const summary = captured.get("summary");
    assert.equal(summary.initialRushee, rushee);
    assert.equal(captured.get("badge").text, "Rush Night");
    summary.onEditImage();
    assert.equal(captured.get("state-3"), true);
});
