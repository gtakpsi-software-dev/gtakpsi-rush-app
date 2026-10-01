import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../src/components/Button.tsx", import.meta.url));

test("button retains its default label, classes, and type", async () => {
    const Button = await loadTsxComponent(componentPath);
    const element = Button({});

    assert.equal(element.type, "button");
    assert.equal(element.props.children, "Submit");
    assert.equal(element.props.type, "button");
    assert.match(element.props.className, /btn-apple {2}mt-3$/);
});

test("button retains variant and size selection, including unknown fallbacks", async () => {
    const Button = await loadTsxComponent(componentPath);
    const secondary = Button({ variant: "secondary", size: "lg", text: "Continue" });
    assert.equal(secondary.props.children, "Continue");
    assert.match(secondary.props.className, /btn-apple-secondary {2}mt-3$/);

    const ghost = Button({ variant: "ghost", size: "lg" });
    assert.match(ghost.props.className, /rounded-apple-xl px-6 py-3 px-8 py-4 text-apple-headline rounded-apple-2xl mt-3$/);

    const unknown = Button({ variant: "unknown", size: "unknown" });
    assert.match(unknown.props.className, /btn-apple undefined mt-3$/);
});

test("button retains later prop overrides and the explicit text child", async () => {
    const Button = await loadTsxComponent(componentPath);
    const onClick = () => {};
    const element = Button({
        text: "Save", children: "Ignored", className: "custom", type: "submit", onClick,
    });
    assert.equal(element.props.className, "custom");
    assert.equal(element.props.type, "submit");
    assert.equal(element.props.onClick, onClick);
    assert.equal(element.props.children, "Save");
    assert.equal(Button({ text: "" }).props.children, "Submit");
});
