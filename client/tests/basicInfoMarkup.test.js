import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../src/components/RegisterComponents/BasicInfo.jsx", import.meta.url));
const expectedHash = "ea94be2a5ee2dd4436a9e19eed43d9388e04c88f6121dcf7d0d3a7df57f4fafd";

test("basic information form keeps its original labels, fields, options, and markup", async () => {
    const BasicInfo = await loadTsxComponent(componentPath);
    const refs = Object.fromEntries([
        "firstname", "lastname", "email", "housing", "phone",
        "gtid", "major", "pronouns", "year", "exposure",
    ].map((name) => [name, { current: null }]));
    const html = renderToStaticMarkup(React.createElement(BasicInfo, {
        ...refs,
        func() {},
    }));

    assert.equal(createHash("sha256").update(html).digest("hex"), expectedHash);
});
