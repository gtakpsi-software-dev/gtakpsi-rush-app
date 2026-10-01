import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import React from 'react';
import { loadTsxComponent } from './helpers/loadTsxComponent.js';
import { syncPropValue } from '../src/features/collaboration/syncPropValue.js';

const fields = [
    {
        name: 'input',
        path: fileURLToPath(new URL('../src/features/collaboration/CollaborativeInput.tsx', import.meta.url)),
        viewImport: './CollaborativeInputView',
        fieldProp: 'fieldKey',
        deferMs: 500,
        expectedChange: ['Remote'],
    },
    {
        name: 'textarea',
        path: fileURLToPath(new URL('../src/features/collaboration/CollaborativeTextarea.tsx', import.meta.url)),
        viewImport: './CollaborativeTextareaView',
        fieldProp: 'questionKey',
        deferMs: 650,
        expectedChange: ['notes', 'Remote', { source: 'remote' }],
    },
];

for (const field of fields) {
    test(`${field.name} retains its remote delay and change callback contract`, async () => {
        const effects = [];
        const helperCalls = [];
        const changes = [];
        const noOp = () => {};
        const RemoteHelper = (options) => {
            helperCalls.push(options);
        };
        const Component = await loadTsxComponent(field.path, {
            react: {
                ...React,
                useRef: (initial) => ({ current: initial }),
                useState: (initial) => [initial, noOp],
                useEffect: (effect) => effects.push(effect),
                useCallback: (callback) => callback,
            },
            '../features/collaboration/activeCursorsForField.js': {
                activeCursorsForField: () => [],
            },
            './activeCursorsForField.js': { activeCursorsForField: () => [] },
            [field.viewImport]: () => null,
            '../features/collaboration/reconcileRemoteFieldUpdate.js': {
                reconcileRemoteFieldUpdate: RemoteHelper,
            },
            './reconcileRemoteFieldUpdate.js': { reconcileRemoteFieldUpdate: RemoteHelper },
            '../features/collaboration/syncPropValue.js': { syncPropValue },
            './syncPropValue.js': { syncPropValue },
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
            onChange: (...args) => changes.push(args),
            collaboration,
        });

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
