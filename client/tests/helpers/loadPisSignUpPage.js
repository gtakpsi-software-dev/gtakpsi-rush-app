import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import React from 'react';
import { transformWithEsbuild } from 'vite';
import { loadTsxComponent } from './loadTsxComponent.js';

const pagePath = fileURLToPath(new URL('../../src/features/registration/pis/PisSignUpStep.tsx', import.meta.url));
const viewPath = fileURLToPath(new URL('../../src/features/registration/pis/PisSignUpView.tsx', import.meta.url));
const cardPath = fileURLToPath(new URL('../../src/features/registration/pis/PisDayCard.tsx', import.meta.url));

// Render a lightweight React element for component assertions.
const Loader = () => React.createElement('span', { 'data-stub': 'loader' });
// Load page with injected dependencies for isolated tests.
export async function loadPage(states, get = /* Leave this mocked callback inert. */ () => {}) {
    const DayCard = existsSync(cardPath) ? await loadTsxComponent(cardPath) : null;
    const View = existsSync(viewPath)
        ? await loadTsxComponent(viewPath, {
            '../../../components/Loader': Loader,
            './PisDayCard': DayCard,
        })
        : null;
    const source = (await readFile(pagePath, 'utf8'))
        .replace('import.meta.env.VITE_API_PREFIX', '"/api"');
    const { code } = await transformWithEsbuild(source, pagePath, {
        loader: 'tsx',
        format: 'cjs',
        jsx: 'automatic',
    });
    const module = { exports: {} };
    const requireFromPage = createRequire(pagePath);
    let stateIndex = 0;
    const setters = [];
    const effects = [];

    runInNewContext(code, {
        module,
        exports: module.exports,
        // Resolve injected test dependencies before falling back to real modules.
        require(specifier) {
            if (specifier === 'react') return {
                // Expose controlled hook state and capture updates for assertions.
                useState: () => {
                    const index = stateIndex++;
                    // Record setter calls for assertions.
                    const setter = (value) => setters.push([index, value]);
                    return [states[index], setter];
                },
                // Capture effects so the test can run them explicitly.
                useEffect: (effect) => effects.push(effect),
            };
            if (specifier === '../Loader') return Loader;
            if (specifier === './PisSignUpView') return View;
            if (specifier === 'axios') return { get };
            return requireFromPage(specifier);
        },
    }, { filename: pagePath });

    return { Page: module.exports.default, setters, effects };
}

// Walk the rendered element tree to collect nodes for assertions.
export function walk(node, elements = []) {
    if (Array.isArray(node)) {
        node.forEach(/* Invoke walk with the test inputs. */ (child) => walk(child, elements));
    } else if (node && typeof node === 'object' && node.type) {
        if (typeof node.type === 'function') {
            walk(node.type(node.props), elements);
        } else {
            elements.push(node);
            walk(node.props.children, elements);
        }
    }
    return elements;
}

// Flatten rendered children into text for label assertions.
export function textOf(node) {
    if (Array.isArray(node)) return node.map(textOf).join('');
    if (node && typeof node === 'object' && node.type) return textOf(node.props.children);
    return node == null || typeof node === 'boolean' ? '' : String(node);
}

