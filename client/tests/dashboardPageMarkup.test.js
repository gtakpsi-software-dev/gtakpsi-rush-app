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

const pagePath = fileURLToPath(new URL('../src/pages/Dashboard.jsx', import.meta.url));
const cardPath = fileURLToPath(new URL('../src/features/dashboard/DashboardRusheeCard.tsx', import.meta.url));
const filtersPath = fileURLToPath(new URL('../src/features/dashboard/DashboardFilters.tsx', import.meta.url));
const fixturePath = fileURLToPath(new URL('./fixtures/dashboardPageMarkup.json', import.meta.url));
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

async function loadDashboard({ state = {}, midterm = false, showRatings = true, open = () => {} } = {}) {
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
    const Filters = await loadTsxComponent(filtersPath);
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
        '../components/PISAvailabilityModal': stub('availability'),
        '../contexts/MidtermModeContext': { useMidtermMode: () => ({ isMidtermMode: midterm }) },
        '../hooks/useCommentVisibility': { useCommentVisibility: () => ({ showAll: showRatings }) },
        'fuse.js': class Fuse {},
        '../features/auth/verifyUser': { verifyUser() {} },
        '../features/dashboard/list': { filterDashboardRushees() {}, shuffleArray() {} },
        '../features/dashboard/loadDashboardData': { loadDashboardData() {} },
        '../features/dashboard/DashboardRusheeCard': Card,
        '../features/dashboard/DashboardFilters': Filters,
        '../firebase': { auth: {}, db: {} },
        'firebase/firestore': { doc() {}, getDoc() {} }
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

test('dashboard retains loading, error, empty, card, midterm, and availability markup', async () => {
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
    const opens = [];
    const state = { 1: false, 5: [rushee], 6: [rushee] };

    function findCard(node) {
        if (Array.isArray(node)) return node.map(findCard).find(Boolean);
        if (!React.isValidElement(node)) return undefined;
        if (node.props.rushee?.gtid === rushee.gtid) return node;
        return findCard(node.props.children);
    }

    const Dashboard = await loadDashboard({ state, open: (...args) => opens.push(args) });
    const card = findCard(Dashboard({ user: { uid: 'brother-1' } }));
    assert.equal(typeof card.type(card.props).props.onClick, 'function');
    card.type(card.props).props.onClick();
    assert.deepEqual(opens, [['/brother/rushee/901234567', '_blank']]);

    const MidtermDashboard = await loadDashboard({ state, midterm: true });
    const midtermCard = findCard(MidtermDashboard({ user: { uid: 'brother-1' } }));
    assert.equal(midtermCard.type(midtermCard.props).props.onClick, undefined);
});

test('dashboard filters keep option order, selections, search, and shuffle callbacks', async () => {
    const Filters = await loadTsxComponent(filtersPath);
    const calls = [];
    const tree = Filters({
        query: 'Ada',
        handleSearch: (event) => calls.push(['search', event.target.value]),
        rushees: [
            { major: 'Computer Science', class: '2028' },
            { major: 'Mathematics', class: '2027' },
            { major: 'Computer Science', class: '2028' }
        ],
        selectedMajor: 'All',
        setSelectedMajor: (value) => calls.push(['major', value]),
        selectedClass: 'All',
        setSelectedClass: (value) => calls.push(['class', value]),
        selectedSort: 'none',
        setSelectedSort: (value) => calls.push(['sort', value]),
        onShuffle: () => calls.push(['shuffle'])
    });
    const elements = [];

    function collect(node) {
        if (Array.isArray(node)) node.forEach(collect);
        else if (React.isValidElement(node)) {
            elements.push(node);
            collect(node.props.children);
        }
    }
    collect(tree);

    const input = elements.find((element) => element.type === 'input');
    const selects = elements.filter((element) => element.type === 'select');
    const button = elements.find((element) => element.type === 'button');
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
