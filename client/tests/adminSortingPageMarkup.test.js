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
import { STATUSES, MIN_SCALE, MAX_SCALE, createEmptyColumns } from '../src/features/sorting/board.js';
import { loadTsxComponent, loadTsxModule } from './helpers/loadTsxComponent.js';
import { parseAdminAllowlist } from '../src/features/auth/parseAdminAllowlist.js';
import { createAdminSortingMoveActions } from '../src/features/sorting/createAdminSortingMoveActions.js';
import { createSortingViewportHandlers } from '../src/features/sorting/createSortingViewportHandlers.js';

const pagePath = fileURLToPath(new URL('../src/pages/AdminSorting.jsx', import.meta.url));
const viewPath = fileURLToPath(new URL('../src/features/sorting/AdminSortingBoardView.tsx', import.meta.url));
const viewportPath = fileURLToPath(new URL('../src/features/sorting/useSortingViewport.js', import.meta.url));
const fixturePath = fileURLToPath(new URL('./fixtures/adminSortingPageMarkup.json', import.meta.url));

async function loadPage(state = {}, captured = new Map()) {
    const stub = (name) => function Stub(props) {
        captured.set(name, props);
        return React.createElement('span', { 'data-stub': name });
    };
    const View = await loadTsxComponent(viewPath, {
        '../../components/Navbar': stub('navbar'),
        './board': { STATUSES },
        './EditableNotesPanel': stub('notes'),
        './SortingColumn': stub('column'),
        './SortingGhostCards': stub('ghosts'),
        './SortingPresenceIndicator': stub('presence'),
        './SortingZoomControls': stub('zoom'),
    });
    const ViewWithCapture = (props) => {
        captured.set('view', props);
        const tree = View(props);
        captured.set('board-root', tree.props);
        captured.set('board-root-ref', tree.ref);
        return tree;
    };
    const source = (await readFile(pagePath, 'utf8'))
        .replaceAll('import.meta.env.VITE_API_PREFIX', '"/api"')
        .replace('import.meta.env.VITE_ADMIN_ALLOWLIST', '"admin@example.edu"');
    const { code } = await transformWithEsbuild(source, pagePath, {
        loader: 'jsx', format: 'cjs', jsx: 'automatic'
    });
    const module = { exports: {} };
    const requireFromPage = createRequire(pagePath);
    const noop = () => {};
    const actions = () => new Proxy({}, { get: () => noop });
    let stateIndex = 0;
    const reactMock = {
        ...React,
        useState(initial) {
            const index = stateIndex++;
            return [Object.hasOwn(state, index) ? state[index] : initial, noop];
        },
        useEffect: noop,
        useRef: (initial) => ({ current: initial }),
        useCallback: (callback) => callback,
    };
    const { useSortingViewport } = await loadTsxModule(viewportPath, {
        react: reactMock,
        './board': { MIN_SCALE, MAX_SCALE },
        './createSortingViewportHandlers': { createSortingViewportHandlers },
    });
    const dependencies = {
        react: reactMock,
        'react-router-dom': { useNavigate: () => noop },
        'react-toastify': { toast: { error: noop } },
        'react-toastify/dist/ReactToastify.css': {},
        '../components/Navbar': stub('navbar'),
        '../firebase': { auth: {} },
        '../features/admin/api': { adminGet: noop, adminPut: noop },
        '../features/auth/parseAdminAllowlist': { parseAdminAllowlist },
        '../features/sorting/board': { STATUSES, MIN_SCALE, MAX_SCALE, createEmptyColumns },
        '../features/sorting/AdminSortingBoardView': ViewWithCapture,
        '../features/sorting/EditableNotesPanel': stub('notes'),
        '../features/sorting/SortingZoomControls': stub('zoom'),
        '../features/sorting/SortingPresenceIndicator': stub('presence'),
        '../features/sorting/SortingGhostCards': stub('ghosts'),
        '../features/sorting/SortingColumn': stub('column'),
        '../features/sorting/useSortingAdminConnection': {
            useSortingAdminConnection: (options) => captured.set('admin-connection', options),
        },
        '../features/sorting/createAdminSortingMoveActions': { createAdminSortingMoveActions },
        '../features/sorting/createSortingDragHandlers': { createSortingDragHandlers: actions },
        '../features/sorting/useSortingViewport': { useSortingViewport },
        '../features/sorting/useSortingWheelListener': {
            useSortingWheelListener: (canvasRef, handleWheel, loading) => {
                captured.set('wheel-listener', { canvasRef, handleWheel, loading });
            },
        },
        '../features/sorting/createSortingNotesHandlers': { createSortingNotesHandlers: actions },
        '../features/sorting/loadAdminSortingData': { loadAdminSortingData: noop },
    };

    runInNewContext(code, {
        module,
        exports: module.exports,
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromPage(specifier);
        },
    }, { filename: pagePath });

    return module.exports.default;
}

test('admin sorting page keeps loading, board, drag, and notes layout', async () => {
    const expected = JSON.parse(await readFile(fixturePath, 'utf8'));
    const scenarios = {
        loading: {},
        ready: { 0: false },
        dragging: { 0: false, 3: { id: 'r1', fromColumn: 'UNSORTED', index: 0 } },
        notes: { 0: false, 5: { id: 'r1', fullName: 'Ada Example' } },
    };

    for (const [name, state] of Object.entries(scenarios)) {
        const Page = await loadPage(state);
        const html = renderToStaticMarkup(React.createElement(Page));
        const hash = createHash('sha256').update(html).digest('hex');
        assert.equal(hash, expected[name], `${name} markup changed`);
    }
});

test('admin sorting page passes board state and callbacks to its controls', async () => {
    const captured = new Map();
    const columns = { ...createEmptyColumns(), UNSORTED: [{ id: 'r1' }] };
    const dragging = { id: 'r1', fromColumn: 'UNSORTED', index: 0 };
    const Page = await loadPage({
        0: false,
        2: columns,
        3: dragging,
        5: { id: 'r1', fullName: 'Ada Example' },
        9: 1.5,
        11: true,
        12: 3,
    }, captured);
    renderToStaticMarkup(React.createElement(Page));

    assert.equal(captured.get('presence').connected, true);
    assert.equal(typeof captured.get('admin-connection').getCancelDragState(), 'function');
    assert.equal(captured.get('presence').viewerCount, 3);
    assert.equal(captured.get('zoom').scale, 1.5);
    assert.equal(captured.get('board-root-ref'), captured.get('view').canvasRef);
    assert.equal(captured.get('wheel-listener').canvasRef, captured.get('view').canvasRef);
    assert.equal(captured.get('wheel-listener').loading, false);
    assert.equal(captured.get('board-root').onMouseDown, captured.get('view').onMouseDown);
    assert.equal(captured.get('board-root').onMouseMove, captured.get('view').onMouseMove);
    assert.equal(captured.get('board-root').onMouseUp, captured.get('view').onMouseUp);
    assert.equal(captured.get('board-root').onMouseLeave, captured.get('view').onMouseUp);
    assert.equal(captured.get('board-root').onContextMenu, captured.get('view').onContextMenu);
    assert.equal(captured.get('column').columns, columns);
    assert.equal(captured.get('column').dragging, dragging);
    assert.equal(captured.get('notes').selectedRushee.id, 'r1');
    assert.equal(typeof captured.get('column').handleDrop, 'function');
    assert.equal(typeof captured.get('notes').onViewRushee, 'function');
});
