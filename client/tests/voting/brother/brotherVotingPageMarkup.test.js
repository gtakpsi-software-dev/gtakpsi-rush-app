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
import { loadTsxComponent } from '../../helpers/loadTsxComponent.js';

const pagePath = fileURLToPath(new URL('../../../src/pages/BrotherVotingPage.tsx', import.meta.url));
const panelPath = fileURLToPath(new URL('../../../src/features/voting/brother/VotingPanel.tsx', import.meta.url));

// Render the voting page with controlled connection state and capture child props.
async function renderVotingPage({ storedUser = '{"_id":"brother-1"}', midtermMode = false, status = 'connecting' } = {}) {
    const VotingPanel = await loadTsxComponent(panelPath);
    const captured = new Map();
    // Create a lightweight component that captures props for assertions.
    const stub = (name) => function Stub(props) {
        // Capture component props and render a placeholder element.
        captured.set(name, props);
        return React.createElement('span', { 'data-stub': name });
    };
    // Supply an inert callback where this test does not exercise the handler.
    const noop = () => {};
    const dependencies = {
        react: {
            ...React,
            // Expose controlled hook state and capture updates for assertions.
            useState: () => [status, noop],
            // Provide a mutable ref without mounting a React component.
            useRef: (current) => ({ current }),
            // Invoke compute with the test inputs.
            useMemo: (compute) => compute(),
            // Keep the callback callable without a React render cycle.
            useCallback: (callback) => callback,
            useEffect: noop,
        },
        'react-router-dom': { useNavigate: /* Provide an inert handler for the test. */ () => noop },
        '../components/Navbar': stub('navbar'),
        '../features/voting/brother/BrotherVotingContext': {
            // Return the use brother voting context fixture for this scenario.
            useBrotherVotingContext: () => ({ setRushee: noop, setQuestion: noop }),
        },
        '../features/voting/brother/BrotherVotingContextProvider': {
            // Return children to the caller.
            BrotherVotingContextProvider: ({ children }) => children,
        },
        '../features/voting/brother/useBrotherVotingSocket': {
            // Invoke captured.set with the test inputs.
            useBrotherVotingSocket: (options) => captured.set('socket', options),
        },
        '../features/voting/brother/QuestionBanner': stub('question'),
        '../features/voting/brother/RusheePreviewCard': stub('rushee'),
        '../features/voting/brother/RusheeComments': stub('comments'),
        '../features/voting/brother/RusheePisInfo': stub('pis'),
        '../features/voting/brother/RusheeScores': stub('scores'),
        '../features/voting/brother/RusheeBidCommitteeNotes': stub('notes'),
        '../features/voting/brother/VotingPanel': VotingPanel,
        '../contexts/MidtermModeContext': { useMidtermMode:
            /* Return the use midterm mode fixture for this scenario. */
            () => ({ isMidtermMode: midtermMode }) },
        '../config/realtimeBaseUrls': { realtimeBaseUrls: { voting: 'ws://voting' } },
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
        localStorage: { getItem: /* Return stored user to the caller. */ () => storedUser },
        // Resolve injected test dependencies before falling back to real modules.
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
    // Verify voter page retains empty, midterm, and socket-status layouts.
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
