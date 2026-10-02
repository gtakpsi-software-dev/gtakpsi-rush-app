import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithEsbuild } from "vite";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const pagePath = fileURLToPath(new URL("../../src/pages/MyPisPage.jsx", import.meta.url));
const viewPath = fileURLToPath(new URL("../../src/features/brotherPis/MyPisPageView.tsx", import.meta.url));
const cardPath = fileURLToPath(new URL("../../src/features/brotherPis/PisAppointmentCard.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../fixtures/myPisPageMarkup.json", import.meta.url));

const appointment = {
    gtid: "123", name: "Ada Example", image_url: "/ada.jpg", pronouns: "she/her",
    email: "ada@example.edu", major: "Computing", class: "Senior",
    attendance: [{ name: "Rush Night" }],
    pis_timeslot: { $date: { $numberLong: "123456789" } },
};

async function loadPage(state = {}, captured = new Map(), runtime = {}) {
    const stub = (name) => function Stub(props) {
        captured.set(name, props);
        return React.createElement("span", { "data-stub": name });
    };
    const Card = await loadTsxComponent(cardPath, {
        "../../components/Badge": stub("badge"),
    });
    const CardWithCapture = (props) => {
        captured.set("appointment-card", props);
        return React.createElement(Card, props);
    };
    const appointmentFormatting = {
        formatPisAppointmentTime: () => "Wednesday at noon",
        getPisAppointmentRelativeTime: () => ({ text: "Completed", color: "text-green-600" }),
    };
    const View = await loadTsxComponent(viewPath, {
        "../../components/Navbar": stub("navbar"),
        "../../components/Loader": stub("loader"),
        "../../components/Error": stub("error"),
        "./PisAppointmentCard": CardWithCapture,
        "./appointments": appointmentFormatting,
    });
    let stateIndex = 0;
    const noop = () => {};
    const dependencies = {
        react: {
            ...React,
            useState(initial) {
                const index = stateIndex++;
                return [Object.hasOwn(state, index) ? state[index] : initial,
                    (value) => runtime.updates?.push([index, value])];
            },
            useEffect: (effect) => runtime.effects?.push(effect),
            useRef: (value) => ({ current: value }),
        },
        "react-router-dom": {
            useNavigate: () => runtime.navigate ?? ((path) => captured.set("navigation", path)),
        },
        "../components/Badge": stub("badge"),
        "../features/auth/verifyUser": { verifyUser: runtime.verify ?? noop },
        "../features/brotherPis/appointments": {
            sortPisAppointments: runtime.sort ?? noop,
        },
        "../features/brotherPis/MyPisPageView": View,
        "../features/admin/api": { adminPost: runtime.post ?? noop },
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
        localStorage: {
            getItem: () => runtime.user ?? '{"firstname":"A","lastname":"B"}',
        },
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromPage(specifier);
        },
    }, { filename: pagePath });

    return module.exports.default;
}

test("my PIS page retains error, loading, empty, and appointment markup", async () => {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const scenarios = {
        error: { 2: true },
        loading: {},
        empty: { 1: false },
        appointment: { 0: [appointment], 1: false },
    };
    const actual = {};

    for (const [name, state] of Object.entries(scenarios)) {
        const Page = await loadPage(state);
        const html = renderToStaticMarkup(React.createElement(Page));
        actual[name] = createHash("sha256").update(html).digest("hex");
    }
    assert.deepEqual(actual, expected);
});

test("appointment card receives its row and keeps profile navigation", async () => {
    const captured = new Map();
    const Page = await loadPage({ 0: [appointment], 1: false }, captured);
    renderToStaticMarkup(React.createElement(Page));

    const card = captured.get("appointment-card");
    assert.equal(card.rushee, appointment);
    assert.equal(card.formattedTime, "Wednesday at noon");
    assert.deepEqual(card.relativeTime, { text: "Completed", color: "text-green-600" });
    assert.equal(captured.get("badge").text, "Rush Night");

    card.onView();
    assert.equal(captured.get("navigation"), "/brother/rushee/123");
});

test("my PIS page fetch uses its initial user and preserves update order", async () => {
    const calls = [];
    const runtime = {
        effects: [], updates: [],
        verify: async () => { calls.push("verify"); return true; },
        post: async (url, payload) => {
            calls.push([url, payload]);
            return { data: { status: "success", payload: [appointment] } };
        },
        sort: (value) => { calls.push("sort"); return value; },
    };
    const Page = await loadPage({}, new Map(), runtime);
    Page();
    runtime.user = '{"firstname":"Changed","lastname":"User"}';
    runtime.effects[0]();
    await setImmediate();

    assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
        "verify",
        ["/api/admin/get-brother-pis", { first_name: "A", last_name: "B" }],
        "sort",
    ]);
    assert.deepEqual(runtime.updates, [
        [1, true], [0, [appointment]], [1, false],
    ]);
});
