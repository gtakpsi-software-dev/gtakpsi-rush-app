import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { transformWithEsbuild } from 'vite';
import { registerCollaborationTextEvents } from '../src/features/pis/registerCollaborationTextEvents.js';

const hookPath = fileURLToPath(new URL('../src/hooks/useCollaboration.js', import.meta.url));

test('collaboration hook registers text events between operations and presence listeners', async () => {
    const source = await readFile(hookPath, 'utf8');
    const { code } = await transformWithEsbuild(source, hookPath, {
        loader: 'js', format: 'cjs',
    });
    const module = { exports: {} };
    const requireFromHook = createRequire(hookPath);
    const effects = [];
    const calls = [];
    const listeners = new Map();
    const socket = {
        on(name, handler) { listeners.set(name, handler); },
        disconnect() { calls.push('disconnect'); },
        removeAllListeners() { calls.push('remove-listeners'); },
    };
    const noop = () => {};
    const dependencies = {
        react: {
            useState: (initial) => [initial, noop],
            useRef: (initial) => ({ current: initial }),
            useEffect: (effect) => effects.push(effect),
            useCallback: (callback) => callback,
        },
        'socket.io-client': {
            io(url, options) {
                calls.push(['connect', url, options.forceNew]);
                return socket;
            },
        },
        '../config/realtimeBaseUrls.js': {
            realtimeBaseUrls: { pisCollaboration: 'ws://collaboration.test' },
        },
        '../features/pis/collaborationProtocol.js': { normalizeDocumentState: noop },
        '../features/pis/registerCollaborationTextEvents.js': { registerCollaborationTextEvents },
        '../features/pis/collaborationPresence.js': {
            applyCursorPosition: noop,
            applyTypingIndicator: noop,
            pruneTypingUsers: noop,
            clearStaleCursors: noop,
            getActiveCursors: noop,
        },
        '../features/pis/operations.js': {
            applyOperation: noop,
            createOperation: noop,
            createOperationsFromDiff: noop,
        },
    };

    runInNewContext(code, {
        module,
        exports: module.exports,
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromHook(specifier);
        },
    }, { filename: hookPath });

    module.exports.useCollaboration('room-1', {
        id: 'me', firstName: 'Ada', lastName: 'Lovelace',
    });
    const cleanup = effects[0]();
    assert.deepEqual(calls[0], ['connect', 'ws://collaboration.test', true]);
    assert.deepEqual([...listeners.keys()], [
        'connect', 'disconnect', 'connect_error', 'users-updated',
        'text-operation', 'text-update', 'text-ack', 'text-reject',
        'cursor-position', 'typing-indicator', 'document-state',
    ]);

    cleanup();
    assert.deepEqual(calls.slice(1), ['disconnect', 'remove-listeners']);
});
