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

import { filterBidCommitteeRushees } from '../src/features/dashboard/bidCommitteeList.js';

const pagePath = fileURLToPath(new URL('../src/pages/BidCommitteeDashboard.jsx', import.meta.url));
const cardPath = fileURLToPath(new URL('../src/features/dashboard/BidCommitteeRusheeCard.tsx', import.meta.url));
const fixturePath = fileURLToPath(new URL('./fixtures/bidCommitteeDashboardMarkup.json', import.meta.url));
const rushee = {
    id: 'rushee-1',
    gtid: '900000001',
    name: 'Ada Example',
    major: 'Business',
    class: '2028',
    registration_order: 7,
    attendance: [{ name: 'Night 1' }],
    interactions_by_night: [],
    ratings: [{ name: 'Leadership', value: 4.5 }]
};

async function loadDashboard({ state = {}, open = () => {} } = {}) {
    const stub = (name) => function Stub() {
        return React.createElement('span', { 'data-stub': name });
    };
    // Test doubles render only the fields needed to pin dashboard markup.
    // eslint-disable-next-line react/prop-types
    const Badges = ({ text }) => React.createElement('span', { 'data-stub': 'badge' }, text);
    const Card = await loadTsxComponent(cardPath, {
        '../../components/Badge': Badges,
        '../../components/RusheeInteractionsByNight': stub('interactions')
    });
    const source = (await readFile(pagePath, 'utf8'))
        .replace('import.meta.env.VITE_API_PREFIX', '"/api"');
    const { code } = await transformWithEsbuild(source, pagePath, {
        loader: 'jsx',
        format: 'cjs',
        jsx: 'automatic'
    });
    const module = { exports: {} };
    const requireFromPage = createRequire(pagePath);
    let stateIndex = 0;
    const dependencies = {
        react: {
            ...React,
            useState: (initial) => {
                const index = stateIndex++;
                return [Object.hasOwn(state, index) ? state[index] : initial, () => {}];
            },
            useEffect: () => {}
        },
        axios: {},
        'react-router-dom': { useNavigate: () => () => {} },
        'react-responsive': { useMediaQuery: () => false },
        '../components/Navbar': stub('navbar'),
        '../components/Error': ({ title, description }) => React.createElement('span', { 'data-stub': 'error' }, `${title}: ${description}`),
        '../components/Loader': stub('loader'),
        '../components/Badge': Badges,
        '../components/RusheeInteractionsByNight': stub('interactions'),
        '../components/Button': stub('button'),
        '../features/auth/verifyUser': { verifyUser() {} },
        '../features/dashboard/bidCommitteeList': { filterBidCommitteeRushees },
        '../features/dashboard/BidCommitteeRusheeCard': Card
    };

    runInNewContext(code, {
        module,
        exports: module.exports,
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromPage(specifier);
        },
        localStorage: { getItem: () => null },
        window: { open }
    }, { filename: pagePath });

    return module.exports.default;
}

test('bid committee dashboard retains loading, error, empty, and numbered-card markup', async () => {
    const expected = JSON.parse(await readFile(fixturePath, 'utf8'));
    const scenarios = {
        loading: {},
        error: { state: { 4: true, 3: 'Access denied' } },
        empty: { state: { 1: false } },
        card: { state: { 1: false, 5: [rushee], 6: [rushee], 11: { [rushee.gtid]: '007' } } }
    };

    for (const [scenario, options] of Object.entries(scenarios)) {
        const Dashboard = await loadDashboard(options);
        const html = renderToStaticMarkup(React.createElement(Dashboard, { user: { uid: 'brother-1' } }));
        const hash = createHash('sha256').update(html).digest('hex');
        assert.equal(hash, expected[scenario], `${scenario} markup changed`);
    }
});

test('numbered cards keep the profile URL and missing-number fallback', async () => {
    function findCard(node) {
        if (Array.isArray(node)) return node.map(findCard).find(Boolean);
        if (!React.isValidElement(node)) return undefined;
        if (node.props.rushee?.gtid === rushee.gtid) return node;
        return findCard(node.props.children);
    }

    for (const [numberMap, expectedNumber] of [
        [{ [rushee.gtid]: '007' }, '007'],
        [{}, '---']
    ]) {
        const opens = [];
        const Dashboard = await loadDashboard({
            state: { 1: false, 5: [rushee], 6: [rushee], 11: numberMap },
            open: (...args) => opens.push(args)
        });
        const card = findCard(Dashboard({ user: { uid: 'brother-1' } }));
        const renderedCard = card.type(card.props);
        assert.equal(card.props.rusheeId, expectedNumber);
        renderedCard.props.onClick();
        assert.deepEqual(opens, [[
            `/brother/rushee/900000001?bid_committee=true&rushee_num=${expectedNumber}`,
            '_blank'
        ]]);
    }
});
