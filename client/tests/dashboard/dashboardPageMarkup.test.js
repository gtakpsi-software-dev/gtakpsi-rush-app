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

const pagePath = fileURLToPath(new URL('../../src/pages/Dashboard.tsx', import.meta.url));
const viewPath = fileURLToPath(new URL('../../src/features/dashboard/DashboardView.tsx', import.meta.url));
const cardPath = fileURLToPath(new URL('../../src/features/dashboard/DashboardRusheeCard.tsx', import.meta.url));
const filtersPath = fileURLToPath(new URL('../../src/features/dashboard/DashboardFilters.tsx', import.meta.url));
const fixturePath = fileURLToPath(new URL('../fixtures/dashboardPageMarkup.json', import.meta.url));
const rushee = {
    id: 'rushee-1',
    gtid: '901234567',
    image_url: '/photo.jpg',
    name: 'Ada Example',
    attendance: [{ name: 'Rush Night' }],
    email: 'ada@example.edu',
    major: 'Computer Science',
    interactions_by_night: [],
    ratings: [{ name: 'Leadership', value: 4.5 }]
};

// Load dashboard with injected dependencies for isolated tests.
async function loadDashboard({ state = {}, midterm = false, showRatings = true, open = /* Leave this mocked callback inert. */ () => {} } = {}) {
    // Create a lightweight component that captures props for assertions.
    const stub = (name) => function Stub() {
        // Capture component props and render a placeholder element.
        return React.createElement('span', { 'data-stub': name });
    };
    // Test doubles render only the fields needed to pin dashboard markup.
    // eslint-disable-next-line react/prop-types
    // Render a lightweight React element for component assertions.
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
        '../brotherPisAvailability/PisAvailabilityModal': stub('availability'),
        './DashboardRusheeCard': Card,
        './DashboardFilters': Filters
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
            // Expose controlled hook state and capture updates for assertions.
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
        '../contexts/MidtermModeContext': { useMidtermMode:
            /* Return the use midterm mode fixture for this scenario. */
            () => ({ isMidtermMode: midterm }) },
        '../features/comments/useCommentVisibility': { useCommentVisibility:
            /* Return the use comment visibility fixture for this scenario. */
            () => ({ showAll: showRatings }) },
        'fuse.js': class Fuse {},
        '../features/auth/verifyUser': { /* Provide an inert verify user stub for this test. */ verifyUser() {} },
        '../features/dashboard/list': {
            /* Provide an inert filter dashboard rushees stub for this test. */
            filterDashboardRushees() {},
            /* Provide an inert shuffle array stub for this test. */
            shuffleArray() {} },
        '../features/dashboard/loadDashboardData': { /* Provide an inert load dashboard data stub for this test. */ loadDashboardData() {} },
        '../features/dashboard/DashboardView': View,
        '../firebase': { auth: {}, db: {} },
        'firebase/firestore': {
            /* Provide an inert doc stub for this test. */
            doc() {},
            /* Provide an inert get doc stub for this test. */
            getDoc() {} }
    };

    runInNewContext(code, {
        module,
        exports: module.exports,
        // Resolve injected test dependencies before falling back to real modules.
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromPage(specifier);
        },
        localStorage: { getItem: /* Return no value from this dependency stub. */ () => null },
        window: { open }
    }, { filename: pagePath });

    return module.exports.default;
}

test('dashboard retains loading, error, empty, card, midterm, and availability markup', async () => {
    // Verify dashboard retains loading, error, empty, card, midterm, and availability markup.
    const expected = JSON.parse(await readFile(fixturePath, 'utf8'));
    const scenarios = {
        loading: {},
        error: { state: { 4: true, 3: 'Access denied' } },
        empty: { state: { 1: false } },
        card: { state: { 1: false, 5: [rushee], 6: [rushee] } },
        midterm: { state: { 1: false, 5: [rushee], 6: [rushee] }, midterm: true },
        availability: { state: { 1: false, 12: true, 13: { uid: 'brother-1' } } }
    };

    for (const [scenario, options] of Object.entries(scenarios)) {
        const Dashboard = await loadDashboard(options);
        const html = renderToStaticMarkup(React.createElement(Dashboard, { user: { uid: 'brother-1' } }));
        const hash = createHash('sha256').update(html).digest('hex');
        assert.equal(hash, expected[scenario], `${scenario} markup changed`);
    }
});

test('dashboard card keeps the profile URL and disables its click in midterm mode', async () => {
    // Verify dashboard card keeps the profile URL and disables its click in midterm mode.
    const opens = [];
    const state = { 1: false, 5: [rushee], 6: [rushee] };

    // Find the rendered card for the fixture rushee.
    function findCard(node) {
        if (Array.isArray(node)) return node.map(findCard).find(Boolean);
        if (!React.isValidElement(node)) return undefined;
        if (node.props.rushee?.gtid === rushee.gtid) return node;
        if (typeof node.type === 'function') return findCard(node.type(node.props));
        return findCard(node.props.children);
    }

    const Dashboard = await loadDashboard({ state, open: /* Record open calls for assertions. */ (...args) => opens.push(args) });
    const card = findCard(Dashboard({ user: { uid: 'brother-1' } }));
    assert.equal(typeof card.type(card.props).props.onClick, 'function');
    card.type(card.props).props.onClick();
    assert.deepEqual(opens, [['/brother/rushee/901234567', '_blank']]);

    const MidtermDashboard = await loadDashboard({ state, midterm: true });
    const midtermCard = findCard(MidtermDashboard({ user: { uid: 'brother-1' } }));
    assert.equal(midtermCard.type(midtermCard.props).props.onClick, undefined);
});

test('dashboard filters keep option order, selections, search, and shuffle callbacks', async () => {
    // Verify dashboard filters keep option order, selections, search, and shuffle callbacks.
    const Filters = await loadTsxComponent(filtersPath);
    const calls = [];
    const tree = Filters({
        query: 'Ada',
        // Record handle search calls for assertions.
        handleSearch: (event) => calls.push(['search', event.target.value]),
        rushees: [
            { major: 'Computer Science', class: '2028' },
            { major: 'Mathematics', class: '2027' },
            { major: 'Computer Science', class: '2028' }
        ],
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
    input.props.onChange({ target: { value: 'Grace' } });
    selects[0].props.onChange({ target: { value: 'Mathematics' } });
    selects[1].props.onChange({ target: { value: '2027' } });
    selects[2].props.onChange({ target: { value: 'lastName' } });
    button.props.onClick();

    assert.deepEqual(calls, [
        ['search', 'Grace'],
        ['major', 'Mathematics'],
        ['class', '2027'],
        ['sort', 'lastName'],
        ['shuffle']
    ]);
    const html = renderToStaticMarkup(tree);
    assert.match(html, /All Majors<\/option><option value="Computer Science">Computer Science<\/option><option value="Mathematics">Mathematics/);
    assert.match(html, /All Years<\/option><option value="2028">2028<\/option><option value="2027">2027/);
});
