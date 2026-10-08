import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { transformWithEsbuild } from 'vite';

const sharedPath = fileURLToPath(new URL('../../src/features/voting/useVotingSocket.ts', import.meta.url));

// Load voting socket hook with injected dependencies for isolated tests.
export async function loadVotingSocketHook(hookPath, exportName) {
    const effects = [];
    const sockets = [];
    const timers = new Map();
    const errors = [];
    let nextTimer = 0;

    class FakeWebSocket {
        // Register a fake socket and initialize its URL and close counter.
        constructor(url) {
            this.url = url;
            this.closeCalls = 0;
            sockets.push(this);
        }
        // Count invocations for assertions.
        close() { this.closeCalls++; }
    }

    const react = {
        // Keep the callback callable without a React render cycle.
        useCallback: (callback) => callback,
        // Capture effects so the test can run them explicitly.
        useEffect: (effect) => effects.push(effect),
    };

    // Load module with injected dependencies for isolated tests.
    async function loadModule(path, dependencies = {}) {
        const source = await readFile(path, 'utf8');
        const { code } = await transformWithEsbuild(source, path, {
            loader: 'ts', format: 'cjs',
        });
        const module = { exports: {} };
        const requireFromModule = createRequire(path);
        runInNewContext(code, {
            module,
            exports: module.exports,
            WebSocket: FakeWebSocket,
            // Store reconnect callbacks and return deterministic timer IDs.
            setTimeout(callback, delay) {
                const id = ++nextTimer;
                timers.set(id, { callback, delay });
                return id;
            },
            // Invoke timers.delete with the test inputs.
            clearTimeout: (id) => timers.delete(id),
            console: {
                /* Provide an inert log stub for this test. */
                log() {}, error:
                /* Record error calls for assertions. */
                (...values) => errors.push(values) },
            // Resolve injected test dependencies before falling back to real modules.
            require(specifier) {
                if (specifier === 'react') return react;
                if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
                return requireFromModule(specifier);
            },
        }, { filename: path });
        return module.exports;
    }

    const shared = await loadModule(sharedPath);
    const wrapper = await loadModule(hookPath, {
        '../../features/voting/useVotingSocket': shared,
        '../useVotingSocket': shared,
    });
    return { [exportName]: wrapper[exportName], effects, sockets, timers, errors };
}
