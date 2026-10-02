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

const pagePath = fileURLToPath(new URL('../src/pages/BrotherVotingPage/index.tsx', import.meta.url));
const panelPath = fileURLToPath(new URL('../src/pages/BrotherVotingPage/VotingPanel.tsx', import.meta.url));

async function renderVotingPage({ storedUser = '{"_id":"brother-1"}', midtermMode = false, status = 'connecting' } = {}) {
    const VotingPanel = await loadTsxComponent(panelPath);
    const captured = new Map();
    const stub = (name) => function Stub(props) {
        captured.set(name, props);
        return React.createElement('span', { 'data-stub': name });
    };
    const noop = () => {};
    const dependencies = {
        react: {
            ...React,
            useState: () => [status, noop],
            useRef: (current) => ({ current }),
            useMemo: (compute) => compute(),
            useCallback: (callback) => callback,
            useEffect: noop,
        },
        'react-router-dom': { useNavigate: () => noop },
        '../../components/Navbar': stub('navbar'),
        '../../features/voting/brother/BrotherVotingContext': {
            useBrotherVotingContext: () => ({ setRushee: noop, setQuestion: noop }),
        },
        '../../features/voting/brother/BrotherVotingContextProvider': {
            BrotherVotingContextProvider: ({ children }) => children,
        },
        '../../features/voting/brother/useBrotherVotingSocket': {
            useBrotherVotingSocket: (options) => captured.set('socket', options),
        },
        './QuestionBanner': stub('question'),
        './RusheePreviewCard': stub('rushee'),
        './RusheeComments': stub('comments'),
        './RusheePISInfo': stub('pis'),
        './RusheeScores': stub('scores'),
        './RusheeBidCommNotes': stub('notes'),
        './VotingPanel': VotingPanel,
        '../../contexts/MidtermModeContext': { useMidtermMode: () => ({ isMidtermMode: midtermMode }) },
        '../../config/realtimeBaseUrls': { realtimeBaseUrls: { voting: 'ws://voting' } },
    };
    const source = await readFile(pagePath, 'utf8');
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

    const html = renderToStaticMarkup(React.createElement(module.exports.default));
    return { html, captured };
}

test('voter page retains empty, midterm, and socket-status layouts', async () => {
    const scenarios = {
        absentUser: { storedUser: null },
        midterm: { midtermMode: true },
        connecting: {},
        connected: { status: 'connected' },
        disconnected: { status: 'disconnected' },
    };
    const hashes = {};
    for (const [name, options] of Object.entries(scenarios)) {
        const { html, captured } = await renderVotingPage(options);
        hashes[name] = createHash('sha256').update(html).digest('hex');
        if (name === 'absentUser') {
            assert.equal(html, '');
        } else if (name === 'midterm') {
            assert.equal(captured.get('question').midtermMode, true);
            assert.equal(captured.get('rushee').midtermMode, true);
        } else {
            assert.equal(captured.get('socket').user._id, 'brother-1');
            assert.equal(captured.get('socket').votingWebSocketUrl, 'ws://voting');
            assert.match(html, /data-stub="scores"/);
            assert.match(html, /data-stub="comments"/);
        }
    }
    assert.deepEqual(hashes, {
        absentUser: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        midterm: '0d5d8030f9cc1242e3e4316b0225348f20a4d60c9d216d7762005b3295575749',
        connecting: '18fe6ac3eedebe2a534f1b9d8408233211433b61c9ca9ad0c367ace845d30e88',
        connected: '0b5ebe67859bb2e0d847d20c57a922f65486e4c12173516fd3880116b55810c9',
        disconnected: 'aa39bbe1a09861ac9d2566153feb768149c78643bbec9445af88362b8fae8829',
    });
});
