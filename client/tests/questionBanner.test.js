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

const bannerPath = fileURLToPath(new URL("../src/pages/BrotherVotingPage/QuestionBanner.tsx", import.meta.url));
const requireFromBanner = createRequire(bannerPath);
const storedUser = '{"_id":"b1","firstname":"Sam","lastname":"Brother"}';

async function loadBanner({ user = storedUser, hasVoted = false } = {}) {
    const source = (await readFile(bannerPath, "utf8"))
        .replaceAll("import.meta.env.VITE_API_PREFIX", '"/api"');
    const { code } = await transformWithEsbuild(source, bannerPath, {
        loader: "tsx", format: "cjs", jsx: "automatic",
    });
    const effects = [];
    const requests = [];
    let stateIndex = 0;
    const noop = () => {};
    const dependencies = {
        react: {
            ...React,
            useState(initial) {
                const value = stateIndex++ === 0 ? hasVoted : initial;
                return [value, noop];
            },
            useEffect: (effect) => effects.push(effect),
        },
        "./BrotherVotingContext": {
            useBrotherVotingContext: () => ({ question: "Who?", setQuestion: noop }),
        },
        "../../components/ReactBitsComponents/SplitText": ({ text }) => (
            React.createElement("span", { "data-stub": "split" }, text)
        ),
        "react-toastify": { toast: { error: noop, promise: async (request) => request } },
        "../NotFound": () => React.createElement("div", { "data-stub": "not-found" }),
        axios: {
            post: async (url, payload) => {
                requests.push({ url, payload });
                return { data: { status: "success" } };
            },
        },
    };
    const module = { exports: {} };
    runInNewContext(code, {
        module,
        exports: module.exports,
        localStorage: { getItem: () => user },
        Math: { random: () => 0.5 },
        console: { log: noop },
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromBanner(specifier);
        },
    }, { filename: bannerPath });

    return { Banner: module.exports.default, effects, requests };
}

test("question banner retains signed-out, regular, voted, and midterm markup", async () => {
    const cases = {
        noUser: { user: null },
        regular: {},
        voted: { hasVoted: true },
        midterm: {},
        midtermVoted: { hasVoted: true },
    };
    const actual = {};
    for (const [name, options] of Object.entries(cases)) {
        const { Banner } = await loadBanner(options);
        const html = renderToStaticMarkup(React.createElement(Banner, {
            midtermMode: name.startsWith("midterm"),
        }));
        actual[name] = createHash("sha256").update(html).digest("hex");
    }

    assert.deepEqual(actual, {
        noUser: "4800d90eb17fd3d5e9f15a72d491aa5de93776cf302a9cf77b384ced368ca6d6",
        regular: "9845d79e862a730d23325db8ad6594eaf10273392ecd6f1cc7c343954b786837",
        voted: "5c85be0e300cd8333b6eebc4b2aa934df80a54dd8129d680c5ea50e4bbe07d90",
        midterm: "6e7d4ae0fe0c50bc3c18fe40c974b51db34a9db0485f94aab0419d3dd219dd04",
        midtermVoted: "3d0e59e89faa913817ef09e97a74b83aa171990d88fae95923e33c5bd6bfdfe6",
    });
});

test("missing user retains the NotFound gate without skipping the reset hook", async () => {
    const { Banner, effects } = await loadBanner({ user: null });
    const tree = Banner({});

    assert.equal(renderToStaticMarkup(tree), '<div data-stub="not-found"></div>');
    assert.equal(effects.length, 1);
});

test("Yes vote retains the API path and brother payload", async () => {
    const { Banner, requests } = await loadBanner();
    const tree = Banner({});
    const findYes = (node) => {
        if (!React.isValidElement(node)) return null;
        if (node.type === "button" && node.props.children === "Yes") return node;
        for (const child of React.Children.toArray(node.props.children)) {
            const found = findYes(child);
            if (found) return found;
        }
        return null;
    };

    await findYes(tree).props.onClick();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "/api/rushee/vote");
    assert.equal(requests[0].payload.brother_id, "b1");
    assert.equal(requests[0].payload.first_name, "Sam");
    assert.equal(requests[0].payload.last_name, "Brother");
    assert.equal(requests[0].payload.vote, "Yes");
});
