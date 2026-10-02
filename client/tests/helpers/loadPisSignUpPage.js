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

const Loader = () => React.createElement('span', { 'data-stub': 'loader' });
export async function loadPage(states, get = () => {}) {
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
        require(specifier) {
            if (specifier === 'react') return {
                useState: () => {
                    const index = stateIndex++;
                    const setter = (value) => setters.push([index, value]);
                    return [states[index], setter];
                },
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

export function walk(node, elements = []) {
    if (Array.isArray(node)) {
        node.forEach((child) => walk(child, elements));
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

export function textOf(node) {
    if (Array.isArray(node)) return node.map(textOf).join('');
    if (node && typeof node === 'object' && node.type) return textOf(node.props.children);
    return node == null || typeof node === 'boolean' ? '' : String(node);
}

