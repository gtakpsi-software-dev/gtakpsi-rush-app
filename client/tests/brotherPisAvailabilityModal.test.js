import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { setImmediate } from 'node:timers';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';

import * as timeslots from '../src/features/brotherPisAvailability/timeslots.js';
import { submitAvailability } from '../src/features/brotherPisAvailability/submitAvailability.js';
import { loadTsxComponent } from './helpers/loadTsxComponent.js';

const componentPath = fileURLToPath(new URL('../src/features/brotherPisAvailability/PISAvailabilityModal.tsx', import.meta.url));
const viewPath = fileURLToPath(new URL('../src/features/brotherPisAvailability/PISAvailabilityView.tsx', import.meta.url));
const fixturePath = fileURLToPath(new URL('./fixtures/brotherPisAvailabilityModal.json', import.meta.url));
const slot = { time: { $date: { $numberLong: String(new Date(2030, 0, 1, 13, 30).getTime()) } } };
const slotIso = timeslots.timeslotIso(slot);

async function loadModal(states, options = {}) {
    const View = await loadTsxComponent(viewPath, { './timeslots': timeslots });
    const source = (await readFile(componentPath, 'utf8'))
        .replace('import.meta.env.VITE_API_PREFIX', '"/api"');
    const { code } = await transformWithEsbuild(source, componentPath, {
        loader: 'tsx',
        format: 'cjs',
        jsx: 'automatic'
    });
    const module = { exports: {} };
    const requireFromComponent = createRequire(componentPath);
    let stateIndex = 0;
    const effects = options.effects || [];

    runInNewContext(code, {
        module,
        exports: module.exports,
        require(specifier) {
            if (specifier === 'react') {
                return {
                    ...React,
                    useState: () => {
                        const index = stateIndex++;
                        return [states[index], (value) => options.setState?.(index, value)];
                    },
                    useEffect: (callback) => effects.push(callback)
                };
            }
            if (specifier === 'axios') return options.axios || {};
            if (specifier === 'react-toastify') return { toast: options.toast || {} };
            if (specifier === './timeslots') return timeslots;
            if (specifier === './submitAvailability') return { submitAvailability };
            if (specifier === './PISAvailabilityView') return View;
            return requireFromComponent(specifier);
        },
        console: options.console || console
    }, { filename: componentPath });

    return module.exports.default;
}

test('brother availability modal retains loading, empty, selected, and submitting markup', async () => {
    const expected = JSON.parse(await readFile(fixturePath, 'utf8'));
    const scenarios = {
        loading: [[], new Set(), true, false],
        empty: [[], new Set(), false, false],
        slots: [[slot], new Set(), false, false],
        selected: [[slot], new Set([slotIso]), false, false],
        submitting: [[slot], new Set([slotIso]), false, true]
    };

    for (const [scenario, states] of Object.entries(scenarios)) {
        const Modal = await loadModal(states);
        const html = renderToStaticMarkup(React.createElement(Modal, {
            user: { firstName: 'Ada', lastName: 'Example' },
            onSubmit() {}
        }));
        const hash = createHash('sha256').update(html).digest('hex');
        assert.equal(hash, expected[scenario], `${scenario} markup changed`);
    }
});

test('brother availability fetch keeps request, payload sorting, and loading order', async () => {
    const calls = [];
    const effects = [];
    const later = { time: { $date: { $numberLong: String(new Date(2030, 0, 2).getTime()) } } };
    const payload = [later, slot];
    const Modal = await loadModal([[], new Set(), true, false], {
        effects,
        axios: {
            get: async (url) => {
                calls.push(['get', url]);
                return { data: { status: 'success', payload } };
            }
        },
        setState: (index, value) => calls.push(['state', index, value])
    });
    Modal({ user: {}, onSubmit() {} });
    assert.equal(effects.length, 1);
    effects[0]();
    await new Promise(setImmediate);

    assert.deepEqual(calls, [
        ['get', '/api/admin/get_pis_timeslots'],
        ['state', 0, [slot, later]],
        ['state', 2, false]
    ]);
    assert.equal(payload[0], slot);
});

test('brother availability fetch leaves slots unchanged on non-success', async () => {
    const calls = [];
    const effects = [];
    const Modal = await loadModal([[], new Set(), true, false], {
        effects,
        axios: { get: async () => ({ data: { status: 'error', payload: [slot] } }) },
        setState: (index, value) => calls.push(['state', index, value])
    });
    Modal({ user: {}, onSubmit() {} });
    effects[0]();
    await new Promise(setImmediate);
    assert.deepEqual(calls, [['state', 2, false]]);
});

test('brother availability fetch reports transport failures and clears loading', async () => {
    const calls = [];
    const effects = [];
    const failure = new Error('offline');
    const Modal = await loadModal([[], new Set(), true, false], {
        effects,
        axios: { get: async () => { throw failure; } },
        toast: { error: (message) => calls.push(['toast', message]) },
        console: { error: (...args) => calls.push(['log', ...args]) },
        setState: (index, value) => calls.push(['state', index, value])
    });
    Modal({ user: {}, onSubmit() {} });
    effects[0]();
    await new Promise(setImmediate);

    assert.deepEqual(calls, [
        ['log', 'Failed to fetch timeslots:', failure],
        ['toast', 'Failed to load timeslots'],
        ['state', 2, false]
    ]);
});

test('brother availability view keeps bulk, slot, and submit callbacks', async () => {
    const View = await loadTsxComponent(viewPath, { './timeslots': timeslots });
    const calls = [];
    const tree = View({
        loading: false,
        timeslots: [slot],
        selectedSlots: new Set(),
        submitting: false,
        groupedSlots: timeslots.groupTimeslots([slot]),
        selectAll: () => calls.push('all'),
        clearAll: () => calls.push('clear'),
        toggleSlot: (value) => calls.push(value),
        handleSubmit: () => calls.push('submit')
    });
    const buttons = [];

    function collect(node) {
        if (Array.isArray(node)) node.forEach(collect);
        else if (React.isValidElement(node)) {
            if (node.type === 'button') buttons.push(node);
            collect(node.props.children);
        }
    }
    collect(tree);
    const button = (label) => buttons.find((element) => element.props.children === label);

    button('Select All').props.onClick();
    button('Clear All').props.onClick();
    button('1:30 PM').props.onClick();
    button('Submit (Not Available)').props.onClick();

    assert.deepEqual(calls, ['all', 'clear', slotIso, 'submit']);
});
