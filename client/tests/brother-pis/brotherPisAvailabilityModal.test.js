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

import * as timeslots from '../../src/features/brotherPisAvailability/timeslots.js';
import { submitAvailability } from '../../src/features/brotherPisAvailability/submitAvailability.js';
import { loadTsxComponent } from '../helpers/loadTsxComponent.js';

const componentPath = fileURLToPath(new URL('../../src/features/brotherPisAvailability/PisAvailabilityModal.tsx', import.meta.url));
const viewPath = fileURLToPath(new URL('../../src/features/brotherPisAvailability/PisAvailabilityView.tsx', import.meta.url));
const fixturePath = fileURLToPath(new URL('../fixtures/brotherPisAvailabilityModal.json', import.meta.url));
const slot = { time: { $date: { $numberLong: String(new Date(2030, 0, 1, 13, 30).getTime()) } } };
const slotIso = timeslots.timeslotIso(slot);

// Load modal with injected dependencies for isolated tests.
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
        // Resolve injected test dependencies before falling back to real modules.
        require(specifier) {
            if (specifier === 'react') {
                return {
                    ...React,
                    // Supply controlled state and a setter without mounting React.
                    useState: () => {
                        const index = stateIndex++;
                        return [states[index],
                            /* Forward state updates to the optional test observer. */
                            (value) => options.setState?.(index, value)];
                    },
                    // Capture effects so the test can run them explicitly.
                    useEffect: (callback) => effects.push(callback)
                };
            }
            if (specifier === 'axios') return options.axios || {};
            if (specifier === 'react-toastify') return { toast: options.toast || {} };
            if (specifier === './timeslots') return timeslots;
            if (specifier === './submitAvailability') return { submitAvailability };
            if (specifier === './PisAvailabilityView') return View;
            return requireFromComponent(specifier);
        },
        console: options.console || console
    }, { filename: componentPath });

    return module.exports.default;
}

test('brother availability modal retains loading, empty, selected, and submitting markup', async () => {
    // Verify brother availability modal retains loading, empty, selected, and submitting markup.
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
            // Provide an inert on submit stub for this test.
            onSubmit() {}
        }));
        const hash = createHash('sha256').update(html).digest('hex');
        assert.equal(hash, expected[scenario], `${scenario} markup changed`);
    }
});

test('brother availability fetch keeps request, payload sorting, and loading order', async () => {
    // Verify brother availability fetch keeps request, payload sorting, and loading order.
    const calls = [];
    const effects = [];
    const later = { time: { $date: { $numberLong: String(new Date(2030, 0, 2).getTime()) } } };
    const payload = [later, slot];
    const Modal = await loadModal([[], new Set(), true, false], {
        effects,
        axios: {
            // Record availability lookup and return the configured payload.
            get: async (url) => {
                calls.push(['get', url]);
                return { data: { status: 'success', payload } };
            }
        },
        // Record set state calls for assertions.
        setState: (index, value) => calls.push(['state', index, value])
    });
    Modal({ user: {}, /* Provide an inert on submit stub for this test. */ onSubmit() {} });
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
    // Verify brother availability fetch leaves slots unchanged on non-success.
    const calls = [];
    const effects = [];
    const Modal = await loadModal([[], new Set(), true, false], {
        effects,
        axios: { get: /* Return the get fixture for this scenario. */ async () => ({ data: { status: 'error', payload: [slot] } }) },
        // Record set state calls for assertions.
        setState: (index, value) => calls.push(['state', index, value])
    });
    Modal({ user: {}, /* Provide an inert on submit stub for this test. */ onSubmit() {} });
    effects[0]();
    await new Promise(setImmediate);
    assert.deepEqual(calls, [['state', 2, false]]);
});

test('brother availability fetch reports transport failures and clears loading', async () => {
    // Verify brother availability fetch reports transport failures and clears loading.
    const calls = [];
    const effects = [];
    const failure = new Error('offline');
    const Modal = await loadModal([[], new Set(), true, false], {
        effects,
        axios: { get: async () => {
            // Simulate a dependency failure for this scenario.
             throw failure; } },
        toast: { error: /* Record error calls for assertions. */ (message) => calls.push(['toast', message]) },
        console: { error: /* Record error calls for assertions. */ (...args) => calls.push(['log', ...args]) },
        // Record set state calls for assertions.
        setState: (index, value) => calls.push(['state', index, value])
    });
    Modal({ user: {}, /* Provide an inert on submit stub for this test. */ onSubmit() {} });
    effects[0]();
    await new Promise(setImmediate);

    assert.deepEqual(calls, [
        ['log', 'Failed to fetch timeslots:', failure],
        ['toast', 'Failed to load timeslots'],
        ['state', 2, false]
    ]);
});

test('brother availability view keeps bulk, slot, and submit callbacks', async () => {
    // Verify brother availability view keeps bulk, slot, and submit callbacks.
    const View = await loadTsxComponent(viewPath, { './timeslots': timeslots });
    const calls = [];
    const tree = View({
        loading: false,
        timeslots: [slot],
        selectedSlots: new Set(),
        submitting: false,
        groupedSlots: timeslots.groupTimeslots([slot]),
        // Record select all calls for assertions.
        selectAll: () => calls.push('all'),
        // Record clear all calls for assertions.
        clearAll: () => calls.push('clear'),
        // Record toggle slot calls for assertions.
        toggleSlot: (value) => calls.push(value),
        // Record handle submit calls for assertions.
        handleSubmit: () => calls.push('submit')
    });
    const buttons = [];

    // Walk the rendered element tree to collect nodes for assertions.
    function collect(node) {
        if (Array.isArray(node)) node.forEach(collect);
        else if (React.isValidElement(node)) {
            if (node.type === 'button') buttons.push(node);
            collect(node.props.children);
        }
    }
    collect(tree);
    // Invoke buttons.find with the test inputs.
    const button = (label) => buttons.find(/* Match the control by its displayed label. */ (element) => element.props.children === label);

    button('Select All').props.onClick();
    button('Clear All').props.onClick();
    button('1:30 PM').props.onClick();
    button('Submit (Not Available)').props.onClick();

    assert.deepEqual(calls, ['all', 'clear', slotIso, 'submit']);
});
