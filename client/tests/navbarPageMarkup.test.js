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

const navbarPath = fileURLToPath(new URL("../src/components/Navbar.tsx", import.meta.url));
const requireFromNavbar = createRequire(navbarPath);

async function renderNavbar(state, props = {}, midterm = false) {
    const source = (await readFile(navbarPath, "utf8"))
        .replaceAll("import.meta.env.VITE_ADMIN_ALLOWLIST", '""');
    const { code } = await transformWithEsbuild(source, navbarPath, {
        loader: "tsx", format: "cjs", jsx: "automatic",
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
        },
        "../js/user": { logout: noop },
        "../features/auth/verifyUser": { verifyUser: noop },
        "../firebase": { auth: {} },
        "../contexts/MidtermModeContext": {
            useMidtermMode: () => ({ isMidtermMode: midterm }),
        },
        "../features/navigation/loadNavbarAuth": { loadNavbarAuth: noop },
        "../features/navigation/NavbarMenu": () => React.createElement("span", { "data-stub": "menu" }),
    };
    const module = { exports: {} };
    runInNewContext(code, {
        module,
        exports: module.exports,
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromNavbar(specifier);
        },
    }, { filename: navbarPath });

    const html = renderToStaticMarkup(React.createElement(module.exports.default, props));
    return createHash("sha256").update(html).digest("hex");
}

test("Navbar retains loading, access, stripped, and midterm markup", async () => {
    const ready = { 3: true, 4: false };
    const actual = {
        loading: await renderNavbar({}),
        anonymous: await renderNavbar({ 4: false }),
        ready: await renderNavbar(ready),
        stripped: await renderNavbar(ready, { stripped: true }),
        midterm: await renderNavbar(ready, {}, true),
    };
    assert.deepEqual(actual, {
        loading: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        anonymous: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        ready: "c80af33a43b5e3962ee18a0fc42db8d0c86917bc00a39c67c2edb3c00a16002e",
        stripped: "ae26ef837d772d789b31674e72485f9df86a3f4f8eb7da7b59bb0a23ba916ab7",
        midterm: "d4602317c034d2be8bb57d21c51c1c5485daaababcf1f41ec22b3795aa42937b",
    });
});
