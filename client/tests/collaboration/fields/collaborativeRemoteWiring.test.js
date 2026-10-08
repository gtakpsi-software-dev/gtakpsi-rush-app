import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import React from 'react';
import { loadTsxComponent } from '../../helpers/loadTsxComponent.js';
import { syncPropValue } from '../../../src/features/collaboration/syncPropValue.js';
import { clearLocalChangeTimers, scheduleLocalChangeTimers } from '../../../src/features/collaboration/scheduleLocalChangeTimers.js';

const fields = [
    {
        name: 'input',
        path: fileURLToPath(new URL('../../../src/features/collaboration/CollaborativeInput.tsx', import.meta.url)),
        viewImport: './CollaborativeInputView',
        fieldProp: 'fieldKey',
        deferMs: 500,
        expectedChange: ['Remote'],
    },
    {
        name: 'textarea',
        path: fileURLToPath(new URL('../../../src/features/collaboration/CollaborativeTextarea.tsx', import.meta.url)),
        viewImport: './CollaborativeTextareaView',
        fieldProp: 'questionKey',
        deferMs: 650,
        expectedChange: ['notes', 'Remote', { source: 'remote' }],
    },
];

for (const field of fields) {
    test(`${field.name} retains its remote delay and change callback contract`, async () => {
        // Verify that field effects forward remote updates with the expected options.
        const effects = [];
        const effectDependencies = [];
        const helperCalls = [];
        const changes = [];
        // Supply an inert callback where this test does not exercise the handler.
        const noOp = () => {};
        // Record remote helper calls for assertions.
        const RemoteHelper = (options) => {
            helperCalls.push(options);
        };
        const Component = await loadTsxComponent(field.path, {
            react: {
                ...React,
                // Provide a mutable ref without mounting a React component.
                useRef: (initial) => ({ current: initial }),
                // Supply controlled state and a setter without mounting React.
                useState: (initial) => [initial, noOp],
                // Capture effects so the test can run them explicitly.
                useEffect: (effect, dependencies) => {
                    effects.push(effect);
                    effectDependencies.push(Array.from(dependencies));
                },
                // Keep the callback callable without a React render cycle.
                useCallback: (callback) => callback,
            },
            '../features/collaboration/activeCursorsForField.js': {
                // Return the active cursors for field fixture for this scenario.
                activeCursorsForField: () => [],
            },
            './activeCursorsForField.js': { activeCursorsForField: /* Return the active cursors for field fixture for this scenario. */ () => [] },
            // Return null from this dependency stub.
            [field.viewImport]: () => null,
            '../features/collaboration/reconcileRemoteFieldUpdate.js': {
                reconcileRemoteFieldUpdate: RemoteHelper,
            },
            './reconcileRemoteFieldUpdate.js': { reconcileRemoteFieldUpdate: RemoteHelper },
            '../features/collaboration/syncPropValue.js': { syncPropValue },
            './syncPropValue.js': { syncPropValue },
            './scheduleLocalChangeTimers.js': { clearLocalChangeTimers, scheduleLocalChangeTimers },
            './useCollaborativeFieldPresence': {
                // Return the use collaborative field presence fixture for this scenario.
                useCollaborativeFieldPresence: () => ({
                    handleFocus: noOp, handleBlur: noOp, handleMouseDown: noOp,
                }),
            },
        });
        const remoteUpdates = [{ field: 'notes', value: 'Remote', version: 3 }];
        const collaboration = {
            remoteUpdates,
            typingUsers: [],
            isConnected: true,
        };
        Component({
            [field.fieldProp]: 'notes',
            value: 'Old',
            // Record on change calls for assertions.
            onChange: (...args) => changes.push(args),
            collaboration,
        });

        assert.deepEqual(effectDependencies[0], field.name === 'textarea'
            ? ['Old', collaboration, 'notes']
            : ['Old', 'Old']);
        effects[1]();
        assert.equal(helperCalls.length, 1);
        assert.equal(helperCalls[0].remoteUpdates, remoteUpdates);
        assert.equal(helperCalls[0].fieldKey, 'notes');
        assert.equal(helperCalls[0].localValue, 'Old');
        assert.equal(helperCalls[0].deferMs, field.deferMs);
        helperCalls[0].onRemoteChange('Remote');
        assert.deepEqual(JSON.parse(JSON.stringify(changes)), [field.expectedChange]);
    });
}
