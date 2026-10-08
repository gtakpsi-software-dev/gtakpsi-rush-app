import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { setImmediate } from 'node:timers';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadPage, textOf, walk } from '../helpers/loadPisSignUpPage.js';

// Return the slot fixture for this scenario.
const slot = (time, label, num_available) => ({
    time: {
        // Return time to the caller.
        toLocaleTimeString: () => time,
        // Return label to the caller.
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

const props = {
    selectedSlot: null,
    flexWindow: false,
    // Provide an inert set selected slot stub for this test.
    setSelectedSlot: () => {},
    // Provide an inert set flex window stub for this test.
    setFlexWindow: () => {},
    // Provide an inert on continue stub for this test.
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
        // Verify signup markup against the scenario snapshot.
        const { Page } = await loadPage(states);
        const html = renderToStaticMarkup(React.createElement(Page, { ...props, ...overrides }));
        const hash = createHash('sha256').update(html).digest('hex');
        assert.equal(hash, expectedHash);
    });
}

test('PIS signup keeps slot, Monday, flexibility, and continue callbacks', async () => {
    // Verify PIS signup keeps slot, Monday, flexibility, and continue callbacks.
    const selected = [];
    const flexibility = [];
    let continued = 0;
    const { Page, setters } = await loadPage([false, false, days, false]);
    const elements = walk(Page({
        ...props,
        // Record set selected slot calls for assertions.
        setSelectedSlot: (value) => selected.push(value),
        // Record set flex window calls for assertions.
        setFlexWindow: (value) => flexibility.push(value),
        // Update continued in the test harness.
        onContinue: () => { continued += 1; },
    }));
    const buttons = elements.filter(/* Identify rendered button elements. */ (element) => element.type === 'button');

    const openSlot = buttons.find(/* Match textOf(button).includes('09:00 AM'). */ (button) => textOf(button).includes('09:00 AM'));
    const fullSlot = buttons.find(/* Match textOf(button).includes('10:00 AM'). */ (button) => textOf(button).includes('10:00 AM'));
    const reveal = buttons.find(/* Match textOf(button).includes('show Monday times'). */ (button) => textOf(button).includes('show Monday times'));
    const continueButton = buttons.find(
        /* Match textOf(button).includes('Continue to Complete Registration'). */
        (button) => textOf(button).includes('Continue to Complete Registration'));

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
        // Update continued in the test harness.
        onContinue: () => { continued += 1; },
        // Record set flex window calls for assertions.
        setFlexWindow: (value) => flexibility.push(value),
    }));
    const checkbox = selectedElements.find(
        /* Find the input with type checkbox. */
        (element) => element.type === 'input' && element.props.type === 'checkbox');
    const selectedContinue = selectedElements.find(
        /* Identify rendered button elements. */
        (element) => element.type === 'button' && textOf(element).includes('Continue to Complete Registration'));
    assert.equal(selectedContinue.props.disabled, false);
    checkbox.props.onChange({ target: { checked: true } });
    selectedContinue.props.onClick();
    assert.deepEqual(flexibility, [true]);
    assert.equal(continued, 1);
});

test('PIS signup fetch keeps its endpoint, day grouping, and per-slot updates', async () => {
    // Verify PIS signup fetch keeps its endpoint, day grouping, and per-slot updates.
    const requests = [];
    const firstTime = Date.parse('2026-01-04T09:00:00-05:00');
    const secondTime = Date.parse('2026-01-04T10:00:00-05:00');
    const mondayTime = Date.parse('2026-01-05T11:00:00-05:00');
    const payload = [firstTime, secondTime, mondayTime].map(/* Return the fixture for this scenario. */ (time, index) => ({
        time: { $date: { $numberLong: String(time) } },
        num_available: index + 1,
    }));
    const { Page, setters, effects } = await loadPage(
        [false, true, new Map(), false],
        (url) => {
            // Record availability lookup and resolve with its payload.
            requests.push(url);
            return Promise.resolve({ data: { status: 'success', payload } });
        },
    );

    Page(props);
    effects[0]();
    await new Promise(setImmediate);

    assert.deepEqual(requests, ['/api/admin/get_pis_timeslots']);
    assert.deepEqual(setters.map(/* Return index to the caller. */ ([index]) => index), [2, 2, 2, 1]);
    const grouped = setters[2][1];
    assert.equal(grouped.size, 2);
    assert.deepEqual(
        Array.from(grouped.values(), /* Invoke Array.from with the test inputs. */ (daySlots) =>
            Array.from(daySlots, /* Return the fixture for this scenario. */ (item) => [item.time.getTime(), item.num_available])),
        [[[firstTime, 1], [secondTime, 2]], [[mondayTime, 3]]],
    );
    assert.equal(setters[3][1], false);
});

test('PIS signup failed status sets error before ending loading', async () => {
    // Verify PIS signup failed status sets error before ending loading.
    const { Page, setters, effects } = await loadPage(
        [false, true, new Map(), false],
        /* Invoke Promise.resolve with the test inputs. */ () => Promise.resolve({ data: { status: 'error' } }),
    );

    Page(props);
    effects[0]();
    await new Promise(setImmediate);

    assert.deepEqual(setters, [[0, true], [1, false]]);
});
