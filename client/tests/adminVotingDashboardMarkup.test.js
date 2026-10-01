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
import { loadTsxComponent } from './helpers/loadTsxComponent.js';
import { parseAdminAllowlist } from '../src/features/auth/parseAdminAllowlist.js';

const pagePath = fileURLToPath(new URL('../src/pages/AdminVotingDashboard/index.tsx', import.meta.url));
const viewPath = fileURLToPath(new URL('../src/pages/AdminVotingDashboard/AdminVotingDashboardView.tsx', import.meta.url));

async function renderDashboard(state = {}, storedUser = '{"_id":"brother-1"}') {
    const captured = new Map();
    const stub = (name) => function Stub(props) {
        captured.set(name, props);
        return React.createElement('span', { 'data-stub': name });
    };
    let stateIndex = 0;
    const react = {
        ...React,
        useState(initial) {
            const index = stateIndex++;
            return [Object.hasOwn(state, index) ? state[index] : initial, () => {}];
        },
        useEffect() {},
        useRef: (initial) => ({ current: initial }),
        useMemo: (compute) => compute(),
        useCallback: (callback) => callback,
    };
    const View = await loadTsxComponent(viewPath, {
        '../../components/Navbar': stub('navbar'),
        './QuestionDisplay': stub('question'),
        './RusheePreviewCard': stub('rushee'),
        './RusheeComments': stub('comments'),
        './VoteSummary': stub('votes'),
        './BrotherList': stub('brothers'),
    });
    const ViewWithCapture = (props) => {
        captured.set('view', props);
        return React.createElement(View, props);
    };
    const dependencies = {
        react,
        'react-router-dom': { useNavigate: () => () => {} },
        '../../components/Navbar': stub('navbar'),
        './AdminVotingContext': {
            AdminVotingContextProvider: ({ children }) => children,
            useAdminVotingContext: () => ({
                votes: [], rushee: null, question: null,
                setVotes() {}, setRushee() {}, setQuestion() {},
            }),
        },
        './QuestionDisplay': stub('question'),
        './RusheePreviewCard': stub('rushee'),
        './RusheeComments': stub('comments'),
        './VoteSummary': stub('votes'),
        './BrotherList': stub('brothers'),
        './AdminVotingDashboardView': ViewWithCapture,
        './useAdminVotingSocket': {
            useAdminVotingSocket: (props) => captured.set('socket', props),
        },
        '../NotFound': stub('not-found'),
        '../../firebase': { auth: {} },
        '../../config/realtimeBaseUrls': { realtimeBaseUrls: { voting: 'ws://localhost' } },
        '../../features/auth/parseAdminAllowlist': { parseAdminAllowlist },
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
        localStorage: { getItem: () => storedUser },
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
