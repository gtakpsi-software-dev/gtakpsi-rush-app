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

const pagePath = fileURLToPath(new URL("../src/pages/MyPISPage.jsx", import.meta.url));
const cardPath = fileURLToPath(new URL("../src/features/brotherPis/PisAppointmentCard.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("./fixtures/myPisPageMarkup.json", import.meta.url));

const appointment = {
    gtid: "123", name: "Ada Example", image_url: "/ada.jpg", pronouns: "she/her",
    email: "ada@example.edu", major: "Computing", class: "Senior",
    attendance: [{ name: "Rush Night" }],
    pis_timeslot: { $date: { $numberLong: "123456789" } },
};

async function loadPage(state = {}, captured = new Map()) {
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
        },
        "react-router-dom": { useNavigate: () => (path) => captured.set("navigation", path) },
        "../components/Navbar": stub("navbar"),
        "../components/Loader": stub("loader"),
        "../components/Error": stub("error"),
        "../components/Badge": stub("badge"),
        "../features/auth/verifyUser": { verifyUser: noop },
        "../features/brotherPis/appointments": {
            sortPisAppointments: noop,
            formatPisAppointmentTime: () => "Wednesday at noon",
            getPisAppointmentRelativeTime: () => ({ text: "Completed", color: "text-green-600" }),
        },
        "../features/brotherPis/PisAppointmentCard": CardWithCapture,
        "../features/admin/api": { adminPost: noop },
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
        localStorage: { getItem: () => '{"firstname":"A","lastname":"B"}' },
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
