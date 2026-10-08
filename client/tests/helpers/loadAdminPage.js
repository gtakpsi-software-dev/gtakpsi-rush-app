import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import React from 'react';
import { transformWithEsbuild } from 'vite';
import { loadTsxComponent } from './loadTsxComponent.js';
import { parseAdminAllowlist } from '../../src/features/auth/parseAdminAllowlist.js';

const pagePath = fileURLToPath(new URL('../../src/pages/Admin.jsx', import.meta.url));
const editorHookPath = fileURLToPath(new URL('../../src/features/admin/availability/useAdminAvailabilityEditor.js', import.meta.url));
const accessHookPath = fileURLToPath(new URL('../../src/features/admin/access/useAdminAccessSettings.js', import.meta.url));
const bootstrapHookPath = fileURLToPath(new URL('../../src/features/admin/bootstrap/useAdminBootstrap.js', import.meta.url));
const managementHookPath = fileURLToPath(new URL('../../src/features/admin/overview/useAdminManagementInputs.js', import.meta.url));
const promotionHookPath = fileURLToPath(new URL('../../src/features/admin/access/useAdminPromotion.js', import.meta.url));
const formHookPath = fileURLToPath(new URL('../../src/features/admin/availability/useAdminAvailabilityForm.js', import.meta.url));
const sectionPath = fileURLToPath(new URL('../../src/features/admin/overview/AdminExportsAccessSection.tsx', import.meta.url));
const managementPath = fileURLToPath(new URL('../../src/features/admin/overview/AdminManagementSection.tsx', import.meta.url));
const viewPath = fileURLToPath(new URL('../../src/features/admin/overview/AdminPageView.tsx', import.meta.url));

// Load admin with injected dependencies for isolated tests.
export async function loadAdmin(state = {}, captured = new Map()) {
    // Create a lightweight component that captures props for assertions.
    const stub = (name) => function Stub(props) {
        // Capture component props and render a placeholder element.
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
    const PageView = await loadTsxComponent(viewPath, {
        '../../../components/Navbar': stub('navbar'),
        '../availability/AvailabilityEditorModal': stub('availability-editor'),
        '../availability/PisAvailabilitySection': stub('availability-section'),
        './AdminExportsAccessSection': Section,
        './AdminManagementSection': Management,
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
    // Supply an inert callback where this test does not exercise the handler.
    const noop = () => {};
    // Provide inert action handlers for any requested property.
    const actions = () => new Proxy({}, { get: /* Provide an inert handler for the test. */ () => noop });
    const search = {
        rusheeSearch: '', setRusheeSearch: noop, filteredRushees: [], setFilteredRushees: noop,
        brotherSearch: '', setBrotherSearch: noop, filteredBrothers: [], setFilteredBrothers: noop
    };
    const dependencies = {
        react: {
            ...React,
            // Expose controlled hook state and capture updates for assertions.
            useState: (initial) => {
                const index = stateIndex++;
                return [Object.hasOwn(state, index) ? state[index] : initial, noop];
            },
            useEffect: noop
        },
        axios: {},
        'react-router-dom': { useNavigate: /* Provide an inert handler for the test. */ () => noop },
        'react-toastify': { toast: {} },
        'react-toastify/dist/ReactToastify.css': {},
        '../features/auth/verifyUser': { verifyUser: noop },
        '../features/auth/parseAdminAllowlist': { parseAdminAllowlist },
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
            // Return the group edit slots fixture for this scenario.
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
        '../features/admin/search/useAdminSearch': { useAdminSearch: /* Return search to the caller. */ () => search },
        '../features/admin/overview/AdminExportsAccessSection': Section,
        '../features/admin/overview/AdminManagementSection': Management,
        '../features/admin/overview/AdminPageView': PageView,
        '../firebase': { auth: {}, db: {} },
        'firebase/firestore': { collection: noop, getDocs: noop }
    };
    dependencies['../features/admin/availability/useAdminAvailabilityEditor'] = await loadTsxComponent(
        editorHookPath,
        {
            react: dependencies.react,
            '../pis/pisTime': { groupEditSlots: /* Return the group edit slots fixture for this scenario. */ () => ({}) },
            './availabilityEditorActions': { createAvailabilityEditorActions: actions },
        },
    );
    dependencies['../features/admin/access/useAdminAccessSettings'] = await loadTsxComponent(
        accessHookPath,
        {
            react: dependencies.react,
            './accessSettingsActions': { createAccessSettingsActions: actions },
        },
    );
    dependencies['../features/admin/bootstrap/useAdminBootstrap'] = await loadTsxComponent(
        bootstrapHookPath,
        {
            react: dependencies.react,
            axios: dependencies.axios,
            'react-toastify': dependencies['react-toastify'],
            'firebase/firestore': dependencies['firebase/firestore'],
            '../../auth/verifyUser': dependencies['../features/auth/verifyUser'],
            '../../../firebase': dependencies['../firebase'],
            './loadAdminData': dependencies['../features/admin/bootstrap/loadAdminData'],
        },
    );
    dependencies['../features/admin/overview/useAdminManagementInputs'] = await loadTsxComponent(
        managementHookPath,
        {
            react: dependencies.react,
            '../pis/questionActions': { createQuestionActions: actions },
        },
    );
    dependencies['../features/admin/access/useAdminPromotion'] = await loadTsxComponent(
        promotionHookPath,
        {
            react: dependencies.react,
            './promotionActions': { createPromotionActions: actions },
        },
    );
    dependencies['../features/admin/availability/useAdminAvailabilityForm'] = await loadTsxComponent(
        formHookPath,
        {
            react: dependencies.react,
            './availabilityFormActions': { createAvailabilityFormActions: actions },
        },
    );

    runInNewContext(code, {
        module,
        exports: module.exports,
        // Resolve injected test dependencies before falling back to real modules.
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromPage(specifier);
        }
    }, { filename: pagePath });

    return module.exports.default;
}

