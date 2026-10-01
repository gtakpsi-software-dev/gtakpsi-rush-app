import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { loadTsxComponent } from './helpers/loadTsxComponent.js';

const badgePath = fileURLToPath(new URL('../src/components/Badge.jsx', import.meta.url));
const baseClass = 'text-apple-caption1 font-light me-2 px-2 py-1 rounded-apple whitespace-nowrap';

const scenarios = [
    ['Night 1', 'bg-red-50 text-red-700 border border-red-200'],
    ['Night 2', 'bg-purple-50 text-purple-700 border border-purple-200'],
    ['PIS Night', 'bg-green-50 text-green-700 border border-green-200'],
    ['Night 4', 'bg-pink-50 text-pink-700 border border-pink-200'],
    ['Closed Night', 'bg-teal-50 text-teal-700 border border-teal-200'],
    ['Other', 'bg-apple-gray-100 text-apple-gray-700'],
    [undefined, 'bg-apple-gray-100 text-apple-gray-700'],
];

for (const [value, colors] of scenarios) {
    test(`badge retains markup for ${value ?? 'missing text'}`, async () => {
        const Badge = await loadTsxComponent(badgePath);
        const html = renderToStaticMarkup(React.createElement(Badge, { text: value }));
        assert.equal(html, `<span class="h-6 ${colors} ${baseClass}">${value ?? ''}</span>`);
    });
}
