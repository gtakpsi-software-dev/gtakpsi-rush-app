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

import { filterBidCommitteeRushees } from '../../src/features/dashboard/bidCommitteeList.js';

const pagePath = fileURLToPath(new URL('../../src/pages/BidCommitteeDashboard.tsx', import.meta.url));
const viewPath = fileURLToPath(new URL('../../src/features/dashboard/BidCommitteeDashboardView.tsx', import.meta.url));
const cardPath = fileURLToPath(new URL('../../src/features/dashboard/BidCommitteeRusheeCard.tsx', import.meta.url));
const filtersPath = fileURLToPath(new URL('../../src/features/dashboard/BidCommitteeFilters.tsx', import.meta.url));
const fixturePath = fileURLToPath(new URL('../fixtures/bidCommitteeDashboardMarkup.json', import.meta.url));
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

// Load dashboard with injected dependencies for isolated tests.
async function loadDashboard({ state = {}, open = /* Leave this mocked callback inert. */ () => {} } = {}) {
    // Create a lightweight component that captures props for assertions.
    const stub = (name) => function Stub() {
        // Capture component props and render a placeholder element.
        return React.createElement('span', { 'data-stub': name });
    };
    // Test doubles render only the fields needed to pin dashboard markup.
    // eslint-disable-next-line react/prop-types
    const Badges = ({ text }) => React.createElement('span', { 'data-stub': 'badge' }, text);
    const Card = await loadTsxComponent(cardPath, {
        '../../components/Badge': Badges,
        '../../components/RusheeInteractionsByNight': stub('interactions')
    });
    const Filters = await loadTsxComponent(filtersPath);
    const View = await loadTsxComponent(viewPath, {
        '../../components/Navbar': stub('navbar'),
        // Render a lightweight React element for component assertions.
        '../../components/Error': ({ title, description }) => React.createElement('span', { 'data-stub': 'error' }, `${title}: ${description}`),
        '../../components/Loader': stub('loader'),
        './BidCommitteeRusheeCard': Card,
        './BidCommitteeFilters': Filters
    });
    const source = (await readFile(pagePath, 'utf8'))
        .replace('import.meta.env.VITE_API_PREFIX', '"/api"');
    const { code } = await transformWithEsbuild(source, pagePath, {
        loader: 'tsx',
        format: 'cjs',
        jsx: 'automatic'
    });
    const module = { exports: {} };
    const requireFromPage = createRequire(pagePath);
    let stateIndex = 0;
    const dependencies = {
        react: {
            ...React,
            // Supply controlled state and a setter without mounting React.
            useState: (initial) => {
                const index = stateIndex++;
                return [Object.hasOwn(state, index) ? state[index] : initial, /* Leave this mocked callback inert. */ () => {}];
            },
            // Provide an inert use effect stub for this test.
            useEffect: () => {}
        },
        axios: {},
        'react-router-dom': { useNavigate:
            /* Provide the callback used by this dependency stub. */
            () =>
            /* Leave this mocked callback inert. */
            () => {} },
        '../features/auth/verifyUser': { /* Provide an inert verify user stub for this test. */ verifyUser() {} },
        '../features/dashboard/bidCommitteeList': { filterBidCommitteeRushees },
        '../features/dashboard/BidCommitteeDashboardView': View
    };

    runInNewContext(code, {
        module,
        exports: module.exports,
        // Resolve injected test dependencies before falling back to real modules.
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromPage(specifier);
        },
        localStorage: { getItem: /* Return null from this dependency stub. */ () => null },
        window: { open }
    }, { filename: pagePath });

    return module.exports.default;
}

test('bid committee dashboard retains loading, error, empty, and numbered-card markup', async () => {
    // Verify bid committee dashboard retains loading, error, empty, and numbered-card markup.
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
    // Verify numbered cards keep the profile URL and missing-number fallback.
    // Find the rendered card for the fixture rushee.
    function findCard(node) {
        if (Array.isArray(node)) return node.map(findCard).find(Boolean);
        if (!React.isValidElement(node)) return undefined;
        if (node.props.rushee?.gtid === rushee.gtid) return node;
        if (typeof node.type === 'function') return findCard(node.type(node.props));
        return findCard(node.props.children);
    }

    for (const [numberMap, expectedNumber] of [
        [{ [rushee.gtid]: '007' }, '007'],
        [{}, '---']
    ]) {
        const opens = [];
        const Dashboard = await loadDashboard({
            state: { 1: false, 5: [rushee], 6: [rushee], 11: numberMap },
            // Record open calls for assertions.
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

test('bid committee filters keep GTID input rules, options, and callbacks', async () => {
    // Verify bid committee filters keep GTID input rules, options, and callbacks.
    const Filters = await loadTsxComponent(filtersPath);
    const calls = [];
    const tree = Filters({
        query: '900000001',
        // Record handle search calls for assertions.
        handleSearch: (event) => calls.push(['search', event.target.value]),
        rushees: [rushee, { ...rushee, major: 'Engineering', class: '2027' }, rushee],
        selectedMajor: 'All',
        // Record set selected major calls for assertions.
        setSelectedMajor: (value) => calls.push(['major', value]),
        selectedClass: 'All',
        // Record set selected class calls for assertions.
        setSelectedClass: (value) => calls.push(['class', value]),
        selectedSort: 'none',
        // Record set selected sort calls for assertions.
        setSelectedSort: (value) => calls.push(['sort', value]),
        // Record on shuffle calls for assertions.
        onShuffle: () => calls.push(['shuffle'])
    });
    const elements = [];

    // Walk the rendered element tree to collect nodes for assertions.
    function collect(node) {
        if (Array.isArray(node)) node.forEach(collect);
        else if (React.isValidElement(node)) {
            elements.push(node);
            collect(node.props.children);
        }
    }
    collect(tree);

    const input = elements.find(/* Identify rendered input elements. */ (element) => element.type === 'input');
    const selects = elements.filter(/* Identify rendered select elements. */ (element) => element.type === 'select');
    const button = elements.find(/* Identify rendered button elements. */ (element) => element.type === 'button');
    assert.equal(input.props.maxLength, '9');
    assert.equal(input.props.pattern, '[0-9]{9}');
    input.props.onChange({ target: { value: '900000002' } });
    selects[0].props.onChange({ target: { value: 'Engineering' } });
    selects[1].props.onChange({ target: { value: '2027' } });
    selects[2].props.onChange({ target: { value: 'rusheeId' } });
    button.props.onClick();
    assert.deepEqual(calls, [
        ['search', '900000002'],
        ['major', 'Engineering'],
        ['class', '2027'],
        ['sort', 'rusheeId'],
        ['shuffle']
    ]);

    const html = renderToStaticMarkup(tree);
    assert.match(html, /All Majors<\/option><option value="Business">Business<\/option><option value="Engineering">Engineering/);
    assert.match(html, /All Classes<\/option><option value="2028">2028<\/option><option value="2027">2027/);
    assert.match(html, /No Sorting<\/option><option value="rusheeId">Sort by Rushee ID/);
});
