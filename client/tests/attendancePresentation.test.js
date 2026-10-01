import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const splashPath = fileURLToPath(new URL("../src/components/AttendanceComponents/SplashPage.tsx", import.meta.url));
const successPath = fileURLToPath(new URL("../src/components/AttendanceComponents/SuccessPage.tsx", import.meta.url));

async function loadSplash(state = {}, calls = []) {
    let stateIndex = 0;
    return loadTsxComponent(splashPath, {
        react: {
            ...React,
            useState(initial) {
                const index = stateIndex++;
                return [Object.hasOwn(state, index) ? state[index] : initial,
                    (value) => calls.push([index, value])];
            },
        },
        "../../features/registration/registrationVerification": {
            verifyGTID: (value) => {
                calls.push(["verify", value]);
                return true;
            },
        },
        "react-router-dom": {
            useNavigate: () => (path) => calls.push(["navigate", path]),
        },
    });
}

function collect(node, elements = []) {
    if (!React.isValidElement(node)) return elements;
    elements.push(node);
    React.Children.forEach(node.props.children, (child) => collect(child, elements));
    return elements;
}

test("attendance splash retains initial, valid, and invalid markup", async () => {
    const actual = {};
    const scenarios = {
        initial: {},
        valid: { 0: "901234567", 1: "" },
        invalid: { 0: "bad", 1: "Invalid GTID" },
    };
    for (const [name, state] of Object.entries(scenarios)) {
        const Splash = await loadSplash(state);
        const html = renderToStaticMarkup(React.createElement(Splash, {
            setGtid() {}, func() {},
        }));
        actual[name] = createHash("sha256").update(html).digest("hex");
    }

    assert.deepEqual(actual, {
        initial: "5414188ea11e72cf7358cb93ebfe821a3ab5971470ca657d2f209686bb928a6b",
        valid: "c886358d8524c5d93ba4d1600775f8a17884e25eb3d4489320beb1d6a85c733a",
        invalid: "f81d1c81eca8e7a9f01707df65d26f5a99b31e0f002d545a76f3097c78c730dd",
    });
});

test("attendance splash retains GTID, registration, and submit actions", async () => {
    const calls = [];
    const Splash = await loadSplash({ 0: "901234567" }, calls);
    const elements = collect(Splash({
        setGtid: (value) => calls.push(["gtid", value]),
        func: () => calls.push(["submit"]),
    }));
    const input = elements.find((element) => element.type === "input");
    const buttons = elements.filter((element) => element.type === "button");

    input.props.onChange({ target: { value: "901234568" } });
    buttons[0].props.onClick();
    buttons[1].props.onClick();
    assert.deepEqual(calls, [
        ["gtid", "901234568"], [0, "901234568"], ["verify", "901234568"],
        [1, ""], ["navigate", "/register"], ["submit"],
    ]);
});

test("attendance success retains optional Back markup and callback", async () => {
    const Success = await loadTsxComponent(successPath);
    const actual = {};
    for (const [name, props] of Object.entries({
        success: {}, back: { goBack() {} },
    })) {
        const html = renderToStaticMarkup(React.createElement(Success, props));
        actual[name] = createHash("sha256").update(html).digest("hex");
    }
    assert.deepEqual(actual, {
        success: "c4ca10993f5dc3b7bdb14fd66f6f7ed765c51b36b0919108400415f201967e8a",
        back: "b22b565cb22bfbd037f9fbbdcdececc8da376a7ecb100e87654ea13930cceddd",
    });

    const calls = [];
    const button = collect(Success({ goBack: () => calls.push("back") }))
        .find((element) => element.type === "button");
    button.props.onClick();
    assert.deepEqual(calls, ["back"]);
});
