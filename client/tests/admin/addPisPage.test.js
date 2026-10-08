import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';

const pagePath = fileURLToPath(new URL('../../src/pages/AddPis.jsx', import.meta.url));
const viewPath = fileURLToPath(new URL('../../src/features/admin/pis/AddPisQuestionForm.tsx', import.meta.url));

// Load page with injected dependencies for isolated tests.
async function loadPage() {
    const values = [];
    const requests = [];
    let cursor = 0;
    const react = {
        ...React,
        // Supply controlled state and a setter without mounting React.
        useState(initial) {
            const index = cursor++;
            if (!Object.hasOwn(values, index)) values[index] = initial;
            return [values[index], (value) => {
                // Update values[index] in the test harness.
                 values[index] = value; }];
        },
        // Provide an inert use effect stub for this test.
        useEffect() {},
    };
    const axios = {
        // Record the POST request and return a successful response.
        async post(url, payload) {
            requests.push({ url, payload });
            return { data: { status: 'success' } };
        },
    };
    const source = (await readFile(pagePath, 'utf8'))
        .replaceAll('import.meta.env.VITE_API_PREFIX', '"/api"');
    const { code } = await transformWithEsbuild(source, pagePath, {
        loader: 'jsx', format: 'cjs', jsx: 'automatic',
    });
    const module = { exports: {} };
    const requireFromPage = createRequire(pagePath);
    const viewSource = await readFile(viewPath, 'utf8');
    const viewCode = await transformWithEsbuild(viewSource, viewPath, {
        loader: 'tsx', format: 'cjs', jsx: 'automatic',
    });
    const viewModule = { exports: {} };
    runInNewContext(viewCode.code, {
        module: viewModule,
        exports: viewModule.exports,
        require: createRequire(viewPath),
    }, { filename: viewPath });
    const dependencies = {
        react,
        axios,
        'react-router-dom': { useNavigate:
            /* Provide the callback used by this dependency stub. */
            () =>
            /* Leave this mocked callback inert. */
            () => {} },
        '../features/auth/verifyUser': { verifyUser: /* Return true from this dependency stub. */ async () => true },
        '../features/admin/pis/AddPisQuestionForm': viewModule.exports.default,
    };
    runInNewContext(code, {
        module,
        exports: module.exports,
        // Resolve injected test dependencies before falling back to real modules.
        require(specifier) {
            return Object.hasOwn(dependencies, specifier)
                ? dependencies[specifier]
                : requireFromPage(specifier);
        },
    }, { filename: pagePath });

    return {
        requests,
        // Reset the hook cursor and render the page again.
        render() {
            cursor = 0;
            return module.exports.default();
        },
    };
}

// Walk the rendered element tree to collect nodes for assertions.
function descendants(node) {
    if (Array.isArray(node)) return node.flatMap(descendants);
    if (!React.isValidElement(node)) return [];
    if (typeof node.type === 'function') return [node, ...descendants(node.type(node.props))];
    return [node, ...descendants(node.props.children)];
}

test('Add PIS retains its form markup and request payload', async () => {
    // Verify Add PIS retains its form markup and request payload.
    const page = await loadPage();
    const first = page.render();
    const markup = renderToStaticMarkup(first);
    assert.equal(
        createHash('sha256').update(markup).digest('hex'),
        '3ff91880360aa204e017b08e8178a87cef28e252730d0cb6b3c54f690c1ed84c'
    );
    assert.match(markup, /Add PIS Question/);
    assert.match(markup, /Category \(blank = always shown to every rushee\)/);
    assert.equal((markup.match(/<input/g) ?? []).length, 3);

    const inputs = descendants(first).filter(/* Identify rendered input elements. */ (node) => node.type === 'input');
    inputs[0].props.onChange({ target: { value: 'Question?' } });
    inputs[1].props.onChange({ target: { value: 'FR' } });
    inputs[2].props.onChange({ target: { value: '  Interview  ' } });

    const ready = page.render();
    assert.match(renderToStaticMarkup(ready), /value="Question\?"/);
    const button = descendants(ready).find(/* Identify rendered button elements. */ (node) => node.type === 'button');
    await button.props.onClick();
    assert.deepEqual(requestsAsPlain(page.requests), [
        {
            url: '/api/admin/add_pis_question',
            payload: { question: 'Question?', question_type: 'FR', category: 'Interview' },
        },
    ]);
});

// Invoke requests.map with the test inputs.
function requestsAsPlain(requests) {
    return requests.map(/* Return the fixture for this scenario. */ ({ url, payload }) => ({ url, payload: { ...payload } }));
}
