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

const summaryPath = fileURLToPath(new URL('../src/pages/AdminVotingDashboardComponents/VoteSummary.tsx', import.meta.url));

async function loadSummary(votes) {
    const posts = [];
    const dependencies = {
        './AdminVotingContext': {
            useAdminVotingContext: () => ({ votes, setVotes: () => {} }),
        },
        'react-icons/fa': {
            FaSync: () => React.createElement('span', { 'data-icon': 'sync' }),
        },
        '../../features/admin/api': {
            adminPost: (url, payload) => {
                posts.push({ url, payload });
                return Promise.resolve({ status: 'success' });
            },
        },
        'react-toastify': { toast: { promise: (promise) => promise } },
    };
    const source = (await readFile(summaryPath, 'utf8'))
        .replaceAll('import.meta.env.VITE_API_PREFIX', '"/api"');
    const { code } = await transformWithEsbuild(source, summaryPath, {
        loader: 'tsx', format: 'cjs', jsx: 'automatic',
    });
    const module = { exports: {} };
    const requireFromSummary = createRequire(summaryPath);
    runInNewContext(code, {
        module,
        exports: module.exports,
        require(specifier) {
            return Object.hasOwn(dependencies, specifier)
                ? dependencies[specifier]
                : requireFromSummary(specifier);
        },
    }, { filename: summaryPath });
    return { Summary: module.exports.default, posts };
}

test('vote summary preserves counts, abstain treatment, and empty state', async () => {
    const { Summary } = await loadSummary([
        { vote: 'Yes' }, { vote: 'Yes' }, { vote: 'No' }, { vote: 'Abstain' },
    ]);
    const html = renderToStaticMarkup(React.createElement(Summary));
    assert.match(html, /Total Votes Received: <span[^>]*>4<\/span>/);
    assert.match(html, /Yes: 2 \(66\.7%\)/);
    assert.match(html, /No: 1 \(33\.3%\)/);
    assert.match(html, /Abstain votes: 1/);
    assert.match(html, /Not included in percentages/);
    assert.equal(
        createHash('sha256').update(html).digest('hex'),
        '9c8d555a7a330bdee77c87049da820bd73f527054e6d1957371868ba5d73ba5b'
    );

    const { Summary: Empty } = await loadSummary([]);
    const emptyHtml = renderToStaticMarkup(React.createElement(Empty));
    assert.match(emptyHtml, /No Yes\/No votes yet/);
    assert.match(emptyHtml, /Total Votes Received: <span[^>]*>0<\/span>/);
});

test('vote summary clears votes through the existing admin endpoint', async () => {
    const { Summary, posts } = await loadSummary([]);
    const tree = Summary({ showBreakdown: false });
    const button = tree.props.children.find((child) => React.isValidElement(child) && child.type === 'button');
    await button.props.onClick();
    assert.deepEqual(posts.map(({ url, payload }) => ({ url, payload: { ...payload } })), [
        { url: '/api/admin/voting/clear-votes', payload: {} },
    ]);
});
