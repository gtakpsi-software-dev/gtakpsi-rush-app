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

const pagePath = fileURLToPath(new URL("../src/pages/BrotherPIS.jsx", import.meta.url));
const viewPath = fileURLToPath(new URL("../src/features/brotherPis/BrotherPisSlotSelectionView.tsx", import.meta.url));
const requireFromPage = createRequire(pagePath);
const requireFromView = createRequire(viewPath);

const slot = {
    time: new Date("2030-01-01T18:00:00Z"),
    rushee_gtid: "900000001",
    rushee_first_name: "Test",
    rushee_last_name: "Rushee",
    first_brother_first_name: "First",
    first_brother_last_name: "Brother",
    second_brother_first_name: "",
    second_brother_last_name: "",
};
const day = slot.time.toDateString();
const slotKey = `${day}zz${slot.time.toISOString()}zz${slot.rushee_gtid}`;

async function loadPage({ loading = false, selectedSlot = null } = {}) {
    const stateValues = [new Map([[day, [slot]]]), selectedSlot, loading];
    const selectedValues = [];
    const submissions = [];
    let stateIndex = 0;
    const noop = () => {};
    const dependencies = {
        react: {
            ...React,
            useState(initial) {
                const index = stateIndex++;
                return [stateValues[index] ?? initial, index === 1 ? (value) => selectedValues.push(value) : noop];
            },
            useEffect: noop,
        },
        "react-router-dom": { useNavigate: () => noop },
        axios: {},
        "../features/auth/verifyUser": { verifyUser: noop },
        "../features/brotherPis/loadBrotherPisSlots": { loadBrotherPisSlots: noop },
        "../features/brotherPis/submitBrotherPisSlot": {
            submitBrotherPisSlot: (options) => submissions.push(options),
        },
        "react-toastify": { toast: {} },
        "react-toastify/dist/ReactToastify.css": {},
        "../components/Navbar": () => React.createElement("nav", null, "Navbar"),
        "../components/Loader": () => React.createElement("div", null, "Loading"),
    };

    const viewSource = await readFile(viewPath, "utf8").catch(() => null);
    if (viewSource) {
        const { code } = await transformWithEsbuild(viewSource, viewPath, {
            loader: "tsx", format: "cjs", jsx: "automatic",
        });
        const viewModule = { exports: {} };
        runInNewContext(code, {
            module: viewModule,
            exports: viewModule.exports,
            require(specifier) {
                if (specifier === "../../components/Navbar") return dependencies["../components/Navbar"];
                if (specifier === "../../components/Loader") return dependencies["../components/Loader"];
                return requireFromView(specifier);
            },
        }, { filename: viewPath });
        dependencies["../features/brotherPis/BrotherPisSlotSelectionView"] = viewModule.exports.default;
    }

    const source = (await readFile(pagePath, "utf8"))
        .replaceAll("import.meta.env.VITE_API_PREFIX", '"/api"');
    const { code } = await transformWithEsbuild(source, pagePath, {
        loader: "jsx", format: "cjs", jsx: "automatic",
    });
    const module = { exports: {} };
    runInNewContext(code, {
        module,
        exports: module.exports,
        localStorage: { getItem: () => '{"firstname":"First","lastname":"Brother"}' },
        alert: noop,
        window: { location: { reload: noop } },
        console: { log: noop, error: noop },
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromPage(specifier);
        },
    }, { filename: pagePath });

    return { Page: module.exports.default, selectedValues, submissions };
}

function findNode(node, predicate) {
    if (!React.isValidElement(node)) return null;
    if (predicate(node)) return node;
    if (typeof node.type === "function") return findNode(node.type(node.props), predicate);
    for (const child of React.Children.toArray(node.props.children)) {
        const found = findNode(child, predicate);
        if (found) return found;
    }
    return null;
}

test("brother PIS loading and slot-selection markup remain unchanged", async () => {
    const actual = {};
    for (const [name, options] of Object.entries({
        loading: { loading: true }, available: {}, selected: { selectedSlot: slotKey },
    })) {
        const { Page } = await loadPage(options);
        const html = renderToStaticMarkup(React.createElement(Page));
        actual[name] = createHash("sha256").update(html).digest("hex");
    }
    assert.deepEqual(actual, {
        loading: "dffcb604f84345ca43bd43e03c70acf49ca4c58026bfe902715bce697ff58747",
        available: "fa0e80119d14e2891ca1e5b58b2720154da2a79f9cfb043aed839ebfb0ea05e0",
        selected: "f22e27dd1091055b5b2898f7c4eb404f47d54fbe38528eef6f3f0b54bae0f8de",
    });
});

test("slot toggle and submit retain the selected key and brother payload", async () => {
    const { Page, selectedValues, submissions } = await loadPage({ selectedSlot: slotKey });
    const tree = Page();
    const selectable = findNode(tree, (node) => node.props.className?.includes("cursor-pointer"));
    const submit = findNode(tree, (node) => node.type === "button" && node.props.children === "Submit Selected Slot");

    selectable.props.onClick();
    submit.props.onClick();
    assert.deepEqual(selectedValues, [null]);
    assert.equal(submissions.length, 1);
    assert.equal(submissions[0].selectedSlot, slotKey);
    assert.equal(submissions[0].user.firstname, "First");
    assert.equal(submissions[0].user.lastname, "Brother");
    assert.equal(submissions[0].api, "/api");
});
