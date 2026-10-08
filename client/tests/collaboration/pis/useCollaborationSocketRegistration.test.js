import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { transformWithEsbuild } from 'vite';
import { registerCollaborationConnectionEvents } from '../../../src/features/pis/registerCollaborationConnectionEvents.js';
import { registerCollaborationFieldEvents } from '../../../src/features/pis/registerCollaborationFieldEvents.js';
import { registerCollaborationTextEvents } from '../../../src/features/pis/registerCollaborationTextEvents.js';

const hookPath = fileURLToPath(new URL('../../../src/features/pis/useCollaboration.js', import.meta.url));

test('collaboration hook keeps socket listener order and cleanup', async () => {
    // Verify collaboration hook keeps socket listener order and cleanup.
    const source = await readFile(hookPath, 'utf8');
    const { code } = await transformWithEsbuild(source, hookPath, {
        loader: 'js', format: 'cjs',
    });
    const module = { exports: {} };
    const requireFromHook = createRequire(hookPath);
    const effects = [];
    const calls = [];
    const listeners = new Map();
    let commandOptions;
    const socket = {
        // Register a socket event handler for explicit test dispatch.
        on(name, handler) { listeners.set(name, handler); },
        // Record disconnect calls for assertions.
        disconnect() { calls.push('disconnect'); },
        // Record remove all listeners calls for assertions.
        removeAllListeners() { calls.push('remove-listeners'); },
    };
    // Supply an inert callback where this test does not exercise the handler.
    const noop = () => {};
    const dependencies = {
        react: {
            // Supply controlled state and a setter without mounting React.
            useState: (initial) => [initial, noop],
            // Provide a mutable ref without mounting a React component.
            useRef: (initial) => ({ current: initial }),
            // Capture effects so the test can run them explicitly.
            useEffect: (effect) => effects.push(effect),
            // Keep the callback callable without a React render cycle.
            useCallback: (callback) => callback,
        },
        'socket.io-client': {
            // Record socket connection options and return the fake socket.
            io(url, options) {
                calls.push(['connect', url, options.forceNew]);
                return socket;
            },
        },
        '../../config/realtimeBaseUrls.js': {
            realtimeBaseUrls: { pisCollaboration: 'ws://collaboration.test' },
        },
        './registerCollaborationConnectionEvents.js': { registerCollaborationConnectionEvents },
        './registerCollaborationFieldEvents.js': { registerCollaborationFieldEvents },
        './registerCollaborationTextEvents.js': { registerCollaborationTextEvents },
        './collaborationPresence.js': {
            pruneTypingUsers: noop,
            clearStaleCursors: noop,
            getActiveCursors: noop,
        },
        './useCollaborationCommands.js': {
            // Capture command dependencies and return inert collaboration commands.
            useCollaborationCommands(options) {
                commandOptions = options;
                return {
                    sendTextOperation: noop, sendTextUpdate: noop,
                    sendCursorPosition: noop, clearCursorPosition: noop,
                    sendTypingIndicator: noop, requestDocumentState: noop,
                };
            },
        },
    };

    runInNewContext(code, {
        module,
        exports: module.exports,
        // Resolve injected test dependencies before falling back to real modules.
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromHook(specifier);
        },
    }, { filename: hookPath });

    module.exports.useCollaboration('room-1', {
        id: 'me', firstName: 'Ada', lastName: 'Lovelace',
    });
    assert.equal(commandOptions.currentUser.id, 'me');
    assert.equal(commandOptions.socket, null);
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
