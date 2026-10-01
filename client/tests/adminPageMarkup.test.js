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

const pagePath = fileURLToPath(new URL('../src/pages/Admin.jsx', import.meta.url));
const editorHookPath = fileURLToPath(new URL('../src/features/admin/availability/useAdminAvailabilityEditor.js', import.meta.url));
const sectionPath = fileURLToPath(new URL('../src/features/admin/overview/AdminExportsAccessSection.tsx', import.meta.url));
const managementPath = fileURLToPath(new URL('../src/features/admin/overview/AdminManagementSection.tsx', import.meta.url));
const fixturePath = fileURLToPath(new URL('./fixtures/adminPageMarkup.json', import.meta.url));

async function loadAdmin(state = {}, captured = new Map()) {
    const stub = (name) => function Stub(props) {
        captured.set(name, props);
        return React.createElement('span', { 'data-stub': name });
    };
    const Section = await loadTsxComponent(sectionPath, {
        '../data/AdminDataActions': stub('data-actions'),
        '../access/AdminAccessCard': stub('admin-access'),
        '../access/AccessSettingsCards': stub('access-settings')
    });
    const Management = await loadTsxComponent(managementPath, {
        '../pis/PisQuestionsCard': stub('questions'),
        '../scheduling/AdminSchedulingCards': stub('scheduling'),
        '../pis/ReschedulePisCard': stub('reschedule')
    });
    const source = (await readFile(pagePath, 'utf8'))
        .replaceAll('import.meta.env.VITE_API_PREFIX', '"/api"')
        .replace('import.meta.env.VITE_ADMIN_ALLOWLIST', '"admin@example.edu"');
    const { code } = await transformWithEsbuild(source, pagePath, {
        loader: 'jsx',
        format: 'cjs',
        jsx: 'automatic'
    });
    const module = { exports: {} };
    const requireFromPage = createRequire(pagePath);
    let stateIndex = 0;
    const noop = () => {};
    const actions = () => new Proxy({}, { get: () => noop });
    const search = {
        rusheeSearch: '', setRusheeSearch: noop, filteredRushees: [], setFilteredRushees: noop,
        brotherSearch: '', setBrotherSearch: noop, filteredBrothers: [], setFilteredBrothers: noop
    };
    const dependencies = {
        react: {
            ...React,
            useState: (initial) => {
                const index = stateIndex++;
                return [Object.hasOwn(state, index) ? state[index] : initial, noop];
            },
            useEffect: noop
        },
        axios: {},
        'react-router-dom': { useNavigate: () => noop },
        'react-toastify': { toast: {} },
        'react-toastify/dist/ReactToastify.css': {},
        '../features/auth/verifyUser': { verifyUser: noop },
        '../components/Navbar': stub('navbar'),
        '../features/admin/bootstrap/loadAdminData': { loadAdminData: noop },
        '../components/Loader': stub('loader'),
        '../features/admin/availability/AvailabilityEditorModal': stub('availability-editor'),
        '../features/admin/availability/availabilityEditorActions': { createAvailabilityEditorActions: actions },
        '../features/admin/availability/PisAvailabilitySection': stub('availability-section'),
        '../features/admin/availability/availabilityFormActions': { createAvailabilityFormActions: actions },
        '../features/admin/pis/PisQuestionsCard': stub('questions'),
        '../features/admin/pis/questionActions': { createQuestionActions: actions },
        '../features/admin/pis/pisTime': {
            formatCurrentPISTime: noop, formatSlotTime: noop, formatTimeslot: noop,
            groupEditSlots: () => ({})
        },
        '../features/admin/pis/ReschedulePisCard': stub('reschedule'),
        '../features/admin/pis/rescheduleActions': { createRescheduleActions: actions },
        '../features/admin/scheduling/AdminSchedulingCards': stub('scheduling'),
        '../features/admin/data/AdminDataActions': stub('data-actions'),
        '../features/admin/data/dataActionHandlers': { createAdminDataActions: actions },
        '../features/admin/data/downloadCsv': { downloadCsv: noop },
        '../features/admin/access/AdminAccessCard': stub('admin-access'),
        '../features/admin/access/promotionActions': { createPromotionActions: actions },
        '../features/admin/access/AccessSettingsCards': stub('access-settings'),
        '../features/admin/access/accessSettingsActions': { createAccessSettingsActions: actions },
        '../features/admin/search/useAdminSearch': { useAdminSearch: () => search },
        '../features/admin/overview/AdminExportsAccessSection': Section,
        '../features/admin/overview/AdminManagementSection': Management,
        '../firebase': { auth: {}, db: {} },
        'firebase/firestore': { collection: noop, getDocs: noop }
    };
    dependencies['../features/admin/availability/useAdminAvailabilityEditor'] = await loadTsxComponent(
        editorHookPath,
        {
            react: dependencies.react,
            '../pis/pisTime': { groupEditSlots: () => ({}) },
            './availabilityEditorActions': { createAvailabilityEditorActions: actions },
        },
    );

    runInNewContext(code, {
        module,
        exports: module.exports,
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromPage(specifier);
        }
    }, { filename: pagePath });

    return module.exports.default;
}

test('admin page keeps loading, ready, and availability-editor layout', async () => {
    const expected = JSON.parse(await readFile(fixturePath, 'utf8'));
    const scenarios = {
        loading: {},
        ready: { 11: false },
        editing: { 11: false, 24: { brother_first_name: 'Ada', brother_last_name: 'Example' } }
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
        0: 'Interview prompt',
        8: 2,
        11: false,
        18: selectedRushee,
        19: availableTimeslots,
        20: '12',
        21: { is_active: true, sent_at: null },
        24: editingBrotherAvailability
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
