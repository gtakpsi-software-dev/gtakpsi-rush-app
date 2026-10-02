import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadAdmin } from './helpers/loadAdminPage.js';

const fixturePath = fileURLToPath(new URL('./fixtures/adminPageMarkup.json', import.meta.url));

test('admin page keeps loading, ready, and availability-editor layout', async () => {
    const expected = JSON.parse(await readFile(fixturePath, 'utf8'));
    const scenarios = {
        loading: {},
        ready: { 0: false },
        editing: { 0: false, 9: { brother_first_name: 'Ada', brother_last_name: 'Example' } }
    };

    for (const [scenario, state] of Object.entries(scenarios)) {
        const Admin = await loadAdmin(state);
        const html = renderToStaticMarkup(React.createElement(Admin));
        const hash = createHash('sha256').update(html).digest('hex');
        assert.equal(hash, expected[scenario], `${scenario} markup changed`);
    }
});

test('admin page passes loaded and edited state to the right sections', async () => {
    const captured = new Map();
    const editingBrotherAvailability = { brother_first_name: 'Ada', brother_last_name: 'Example' };
    const selectedRushee = { first_name: 'Grace', last_name: 'Example' };
    const availableTimeslots = [{ timeslot_id: 12 }];
    const Admin = await loadAdmin({
        18: 'Interview prompt',
        26: 2,
        0: false,
        3: selectedRushee,
        4: availableTimeslots,
        5: '12',
        6: { is_active: true, sent_at: null },
        9: editingBrotherAvailability
    }, captured);
    renderToStaticMarkup(React.createElement(Admin));

    assert.equal(captured.get('questions').question, 'Interview prompt');
    assert.equal(captured.get('scheduling').timeslotChange, 2);
    assert.equal(captured.get('reschedule').selectedRushee, selectedRushee);
    assert.equal(captured.get('reschedule').availableTimeslots, availableTimeslots);
    assert.equal(captured.get('reschedule').selectedNewTimeslot, '12');
    assert.equal(typeof captured.get('reschedule').handleReschedulePIS, 'function');
    assert.equal(captured.get('availability-section').pisFormStatus.is_active, true);
    assert.equal(captured.get('availability-editor').editingBrotherAvailability, editingBrotherAvailability);
    assert.equal(typeof captured.get('data-actions').handleRequest, 'function');
    assert.equal(captured.get('questions').handleRequest, captured.get('data-actions').handleRequest);
    assert.equal(captured.get('scheduling').handleRequest, captured.get('data-actions').handleRequest);
});
