import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadTsxComponent } from './helpers/loadTsxComponent.js';

const viewPath = fileURLToPath(new URL('../src/features/collaboration/CollaborativeInputView.tsx', import.meta.url));

test('input view keeps field handlers, state, and lock label attached', async () => {
    const View = await loadTsxComponent(viewPath);
    const handler = () => {};
    const props = {
        inputRef: { current: null },
        className: 'name',
        placeholder: 'Your name',
        localValue: 'Ada',
        disabled: true,
        required: true,
        isFieldLocked: true,
        lockedByUser: 'Grace',
        handleTextChange: handler,
        handleCursorChange: handler,
        handleFocus: handler,
        handleBlur: handler,
        handleMouseDown: handler,
    };

    const tree = View(props);
    const [input, overlay] = tree.props.children;
    assert.equal(input.ref, props.inputRef);
    assert.equal(input.props.value, 'Ada');
    assert.equal(input.props.disabled, true);
    assert.equal(input.props.required, true);
    assert.equal(input.props.onChange, handler);
    assert.equal(input.props.onSelect, handler);
    assert.equal(input.props.onClick, handler);
    assert.equal(input.props.onFocus, handler);
    assert.equal(input.props.onBlur, handler);
    assert.equal(input.props.onMouseDown, handler);
    assert.equal(overlay.props.children.props.children.join(''), 'Grace is typing');
});
