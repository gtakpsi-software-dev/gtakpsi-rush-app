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
import { loadTsxComponent } from '../helpers/loadTsxComponent.js';
import { parseAdminAllowlist } from '../../src/features/auth/parseAdminAllowlist.js';

const pagePath = fileURLToPath(new URL('../../src/pages/AdminVotingDashboard.tsx', import.meta.url));
const viewPath = fileURLToPath(new URL('../../src/features/voting/admin/AdminVotingDashboardView.tsx', import.meta.url));

// Render the dashboard with controlled state and capture child props.
async function renderDashboard(state = {}, storedUser = '{"_id":"brother-1"}') {
    const captured = new Map();
    // Create a lightweight component that captures props for assertions.
    const stub = (name) => function Stub(props) {
        // Capture component props and render a placeholder element.
        captured.set(name, props);
        return React.createElement('span', { 'data-stub': name });
    };
    let stateIndex = 0;
    const react = {
        ...React,
        // Expose controlled hook state and capture updates for assertions.
        useState(initial) {
            const index = stateIndex++;
            return [Object.hasOwn(state, index) ? state[index] : initial, /* Leave this mocked callback inert. */ () => {}];
        },
        // Provide an inert use effect stub for this test.
        useEffect() {},
        // Provide a mutable ref without mounting a React component.
        useRef: (initial) => ({ current: initial }),
        // Invoke compute with the test inputs.
        useMemo: (compute) => compute(),
        // Keep the callback callable without a React render cycle.
        useCallback: (callback) => callback,
    };
    const View = await loadTsxComponent(viewPath, {
        '../../../components/Navbar': stub('navbar'),
        './QuestionDisplay': stub('question'),
        './RusheePreviewCard': stub('rushee'),
        './RusheeComments': stub('comments'),
        './VoteSummary': stub('votes'),
        './BrotherList': stub('brothers'),
    });
    // Capture view props before rendering the real view.
    const ViewWithCapture = (props) => {
        captured.set('view', props);
        return React.createElement(View, props);
    };
    const dependencies = {
        react,
        'react-router-dom': { useNavigate:
            /* Provide the callback used by this dependency stub. */
            () =>
            /* Leave this mocked callback inert. */
            () => {} },
        '../features/voting/admin/AdminVotingContext': {
            // Return the use admin voting context fixture for this scenario.
            useAdminVotingContext: () => ({
                votes: [], rushee: null, question: null,
                // Provide an inert set votes stub for this test.
                setVotes() {},
                    /* Provide an inert set rushee stub for this test. */
                    setRushee() {},
                    /* Provide an inert set question stub for this test. */
                    setQuestion() {},
            }),
        },
        '../features/voting/admin/AdminVotingContextProvider': {
            // Return children to the caller.
            AdminVotingContextProvider: ({ children }) => children,
        },
        '../features/voting/admin/AdminVotingDashboardView': ViewWithCapture,
        '../features/voting/admin/useAdminVotingSocket': {
            // Invoke captured.set with the test inputs.
            useAdminVotingSocket: (props) => captured.set('socket', props),
        },
        '../firebase': { auth: {} },
        '../config/realtimeBaseUrls': { realtimeBaseUrls: { voting: 'ws://localhost' } },
        '../features/auth/parseAdminAllowlist': { parseAdminAllowlist },
    };
    const source = (await readFile(pagePath, 'utf8'))
        .replace('import.meta.env.VITE_ADMIN_ALLOWLIST', '"admin@example.edu"');
    const { code } = await transformWithEsbuild(source, pagePath, {
        loader: 'tsx', format: 'cjs', jsx: 'automatic',
    });
    const module = { exports: {} };
    const requireFromPage = createRequire(pagePath);
    runInNewContext(code, {
        module,
        exports: module.exports,
        localStorage: { getItem: /* Return stored user to the caller. */ () => storedUser },
        // Resolve injected test dependencies before falling back to real modules.
        require(specifier) {
            return Object.hasOwn(dependencies, specifier)
                ? dependencies[specifier]
                : requireFromPage(specifier);
        },
    }, { filename: pagePath });

    return {
        html: renderToStaticMarkup(React.createElement(module.exports.default)),
        captured,
    };
}

test('admin voting dashboard retains auth gating and three socket-status layouts', async () => {
    // Verify admin voting dashboard retains auth gating and three socket-status layouts.
    const scenarios = {
        loading: {},
        unauthorized: { 0: false, 1: false },
        connecting: { 0: true, 1: false },
        connected: { 0: true, 1: false, 3: 'connected' },
        disconnected: { 0: true, 1: false, 3: 'disconnected' },
    };
    const hashes = {};
    for (const [name, state] of Object.entries(scenarios)) {
        const { html, captured } = await renderDashboard(state);
        hashes[name] = createHash('sha256').update(html).digest('hex');
        if (name === 'loading' || name === 'unauthorized') {
            assert.equal(html, '');
        } else {
            assert.equal(captured.get('votes').showBreakdown, true);
            assert.equal(captured.get('socket').authorized, true);
            assert.equal(captured.get('socket').user._id, 'brother-1');
            assert.equal(captured.get('socket').votingWebSocketUrl, 'ws://localhost');
            assert.match(html, /data-stub="question"/);
            assert.match(html, /data-stub="brothers"/);
        }
    }
    assert.deepEqual(hashes, {
        loading: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        unauthorized: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        connecting: '5757726286e53431db18243ba8b4d483c1106b9ff5ec3ecad6ebfb83092864dc',
        connected: '1425d34e244bb7c8ae101601b92cf404045dd06f75111e74acad5d47612351f0',
        disconnected: '5569e48dd45886d96a596a62d52dd4ae72469072f44465bc2bf8ce9e0ed28d62',
    });
    const withoutStoredUser = await renderDashboard({ 0: true, 1: false }, null);
    assert.equal(withoutStoredUser.html, '');
});
