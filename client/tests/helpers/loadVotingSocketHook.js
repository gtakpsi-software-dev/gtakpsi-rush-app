import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { transformWithEsbuild } from 'vite';

const sharedPath = fileURLToPath(new URL('../../src/features/voting/useVotingSocket.ts', import.meta.url));

export async function loadVotingSocketHook(hookPath, exportName) {
    const effects = [];
    const sockets = [];
    const timers = new Map();
    const errors = [];
    let nextTimer = 0;

    class FakeWebSocket {
        constructor(url) {
            this.url = url;
            this.closeCalls = 0;
            sockets.push(this);
        }
        close() { this.closeCalls++; }
    }

    const react = {
        useCallback: (callback) => callback,
        useEffect: (effect) => effects.push(effect),
    };

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
            setTimeout(callback, delay) {
                const id = ++nextTimer;
                timers.set(id, { callback, delay });
                return id;
            },
            clearTimeout: (id) => timers.delete(id),
            console: { log() {}, error: (...values) => errors.push(values) },
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
    });
    return { [exportName]: wrapper[exportName], effects, sockets, timers, errors };
}
