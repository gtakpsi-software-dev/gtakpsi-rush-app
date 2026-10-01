import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { setImmediate } from 'node:timers';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';

import { loadTsxComponent } from './helpers/loadTsxComponent.js';

const pagePath = fileURLToPath(new URL('../src/features/registration/pis/PisSignUpStep.tsx', import.meta.url));
const viewPath = fileURLToPath(new URL('../src/features/registration/pis/PisSignUpView.tsx', import.meta.url));
const cardPath = fileURLToPath(new URL('../src/features/registration/pis/PisDayCard.tsx', import.meta.url));

const Loader = () => React.createElement('span', { 'data-stub': 'loader' });
const slot = (time, label, num_available) => ({
    time: {
        toLocaleTimeString: () => time,
        toLocaleString: () => label,
    },
    num_available,
});
const sundayOpen = slot('09:00 AM', 'Sunday 9:00 AM', 2);
const sundayFull = slot('10:00 AM', 'Sunday 10:00 AM', 0);
const mondayOpen = slot('11:00 AM', 'Monday 11:00 AM', 1);
const days = new Map([
    ['Sun Jan 04 2026', [sundayOpen, sundayFull]],
    ['Mon Jan 05 2026', [mondayOpen]],
]);

async function loadPage(states, get = () => {}) {
    const DayCard = existsSync(cardPath) ? await loadTsxComponent(cardPath) : null;
    const View = existsSync(viewPath)
        ? await loadTsxComponent(viewPath, {
            '../../../components/Loader': Loader,
            './PisDayCard': DayCard,
        })
        : null;
    const source = (await readFile(pagePath, 'utf8'))
        .replace('import.meta.env.VITE_API_PREFIX', '"/api"');
    const { code } = await transformWithEsbuild(source, pagePath, {
        loader: 'tsx',
        format: 'cjs',
        jsx: 'automatic',
    });
    const module = { exports: {} };
    const requireFromPage = createRequire(pagePath);
    let stateIndex = 0;
    const setters = [];
    const effects = [];

    runInNewContext(code, {
        module,
        exports: module.exports,
        require(specifier) {
            if (specifier === 'react') return {
                useState: () => {
                    const index = stateIndex++;
                    const setter = (value) => setters.push([index, value]);
                    return [states[index], setter];
                },
                useEffect: (effect) => effects.push(effect),
            };
            if (specifier === '../Loader') return Loader;
            if (specifier === './PisSignUpView') return View;
            if (specifier === 'axios') return { get };
            return requireFromPage(specifier);
        },
    }, { filename: pagePath });

    return { Page: module.exports.default, setters, effects };
}

function walk(node, elements = []) {
    if (Array.isArray(node)) {
        node.forEach((child) => walk(child, elements));
    } else if (node && typeof node === 'object' && node.type) {
        if (typeof node.type === 'function') {
            walk(node.type(node.props), elements);
        } else {
            elements.push(node);
            walk(node.props.children, elements);
        }
    }
    return elements;
}

function textOf(node) {
    if (Array.isArray(node)) return node.map(textOf).join('');
    if (node && typeof node === 'object' && node.type) return textOf(node.props.children);
    return node == null || typeof node === 'boolean' ? '' : String(node);
}

const props = {
    selectedSlot: null,
    flexWindow: false,
    setSelectedSlot: () => {},
    setFlexWindow: () => {},
    onContinue: () => {},
};

const scenarios = [
    ['error', [true, true, new Map(), false], {}, 'a5a855d14cfd6e93495cdad31abc74ad23d39c3b61a977854832c6baadaa0adf'],
    ['loading', [false, true, new Map(), false], {}, '542806ab3e89b33c5727f828424b4fbee4cbe2483a1237b14165e8e9908eaa28'],
    ['empty', [false, false, new Map(), false], {}, '01fad8ceb0c51766f27d01e141cb18eceebf3a994bf3469f23c94b4f8125fc58'],
    ['Sunday with Monday hidden', [false, false, days, false], {}, '8040ddedd580a97ed04a9d2b5b41f101bdbd6a8de1a2618c177ef864b7a08e8a'],
    ['Sunday selected', [false, false, days, false], { selectedSlot: sundayOpen }, '88ddf79ae5c8633af112c5aa3f8f294ac877aabaa9cc320f5797e8f2648c647b'],
    ['Monday revealed but unselected', [false, false, days, true], {}, '4d9f740c90aaf3715ce79c3282c99704a6766f8e345d6951bd0045f60e1268ee'],
    ['Monday revealed and selected', [false, false, days, true], { selectedSlot: mondayOpen, flexWindow: true }, 'e66e32264af2d90a4677f3821217051457586705fa736a595a575310575c2bd0'],
];

for (const [name, states, overrides, expectedHash] of scenarios) {
    test(`PIS signup retains ${name} markup`, async () => {
        const { Page } = await loadPage(states);
        const html = renderToStaticMarkup(React.createElement(Page, { ...props, ...overrides }));
        const hash = createHash('sha256').update(html).digest('hex');
        assert.equal(hash, expectedHash);
    });
}

test('PIS signup keeps slot, Monday, flexibility, and continue callbacks', async () => {
    const selected = [];
    const flexibility = [];
    let continued = 0;
    const { Page, setters } = await loadPage([false, false, days, false]);
    const elements = walk(Page({
        ...props,
        setSelectedSlot: (value) => selected.push(value),
        setFlexWindow: (value) => flexibility.push(value),
        onContinue: () => { continued += 1; },
    }));
    const buttons = elements.filter((element) => element.type === 'button');

    const openSlot = buttons.find((button) => textOf(button).includes('09:00 AM'));
    const fullSlot = buttons.find((button) => textOf(button).includes('10:00 AM'));
    const reveal = buttons.find((button) => textOf(button).includes('show Monday times'));
    const continueButton = buttons.find((button) => textOf(button).includes('Continue to Complete Registration'));

    assert.equal(fullSlot.props.disabled, true);
    assert.equal(continueButton.props.disabled, true);
    openSlot.props.onClick();
    reveal.props.onClick();
    assert.equal(selected[0], sundayOpen);
    assert.deepEqual(setters, [[3, true]]);

    const { Page: SelectedPage } = await loadPage([false, false, days, true]);
    const selectedElements = walk(SelectedPage({
        ...props,
        selectedSlot: mondayOpen,
        onContinue: () => { continued += 1; },
        setFlexWindow: (value) => flexibility.push(value),
    }));
    const checkbox = selectedElements.find((element) => element.type === 'input' && element.props.type === 'checkbox');
    const selectedContinue = selectedElements.find((element) => element.type === 'button' && textOf(element).includes('Continue to Complete Registration'));
    assert.equal(selectedContinue.props.disabled, false);
    checkbox.props.onChange({ target: { checked: true } });
    selectedContinue.props.onClick();
    assert.deepEqual(flexibility, [true]);
    assert.equal(continued, 1);
});

test('PIS signup fetch keeps its endpoint, day grouping, and per-slot updates', async () => {
    const requests = [];
    const firstTime = Date.parse('2026-01-04T09:00:00-05:00');
    const secondTime = Date.parse('2026-01-04T10:00:00-05:00');
    const mondayTime = Date.parse('2026-01-05T11:00:00-05:00');
    const payload = [firstTime, secondTime, mondayTime].map((time, index) => ({
        time: { $date: { $numberLong: String(time) } },
        num_available: index + 1,
    }));
    const { Page, setters, effects } = await loadPage(
        [false, true, new Map(), false],
        (url) => {
            requests.push(url);
            return Promise.resolve({ data: { status: 'success', payload } });
        },
    );

    Page(props);
    effects[0]();
    await new Promise(setImmediate);

    assert.deepEqual(requests, ['/api/admin/get_pis_timeslots']);
    assert.deepEqual(setters.map(([index]) => index), [2, 2, 2, 1]);
    const grouped = setters[2][1];
    assert.equal(grouped.size, 2);
    assert.deepEqual(
        Array.from(grouped.values(), (daySlots) =>
            Array.from(daySlots, (item) => [item.time.getTime(), item.num_available])),
        [[[firstTime, 1], [secondTime, 2]], [[mondayTime, 3]]],
    );
    assert.equal(setters[3][1], false);
});

test('PIS signup failed status sets error before ending loading', async () => {
    const { Page, setters, effects } = await loadPage(
        [false, true, new Map(), false],
        () => Promise.resolve({ data: { status: 'error' } }),
    );

    Page(props);
    effects[0]();
    await new Promise(setImmediate);

    assert.deepEqual(setters, [[0, true], [1, false]]);
});
