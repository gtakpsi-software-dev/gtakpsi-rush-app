import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadTsxComponent } from './helpers/loadTsxComponent.js';

const viewPath = fileURLToPath(new URL('../src/features/collaboration/CollaborativeTextareaView.tsx', import.meta.url));

test('textarea view preserves input handlers, cursor positions, and cursor colors', async () => {
    const caretCalls = [];
    const View = await loadTsxComponent(viewPath, {
        'textarea-caret': (element, position) => {
            caretCalls.push([element, position]);
            return { left: position * 2, top: position * 3 };
        },
    });
    const field = { value: 'Initial' };
    const handler = () => {};
    const props = {
        textareaRef: { current: field },
        colorMapRef: { current: {} },
        className: 'notes',
        placeholder: 'Write here',
        localValue: 'Initial',
        disabled: false,
        isFieldLocked: false,
        isConnected: true,
        otherUserCursors: [{ id: 'editor-1', name: 'Editor', cursor: 4 }],
        handleTextChange: handler,
        handleCursorChange: handler,
        handleFocus: handler,
        handleBlur: handler,
        handleMouseDown: handler,
        handleCompositionStart: handler,
        handleCompositionEnd: handler,
    };

    const first = View(props);
    const textarea = first.props.children[0];
    const cursor = first.props.children[3][0];
    assert.equal(textarea.ref, props.textareaRef);
    assert.equal(textarea.props.value, 'Initial');
    assert.equal(textarea.props.onChange, handler);
    assert.equal(textarea.props.onSelect, handler);
    assert.equal(textarea.props.onClick, handler);
    assert.equal(textarea.props.onFocus, handler);
    assert.equal(textarea.props.onBlur, handler);
    assert.equal(textarea.props.onMouseDown, handler);
    assert.equal(textarea.props.onCompositionStart, handler);
    assert.equal(textarea.props.onCompositionEnd, handler);
    assert.equal(cursor.props.style.left, '8px');
    assert.equal(cursor.props.style.top, '12px');
    assert.deepEqual(caretCalls, [[field, 4]]);

    const color = props.colorMapRef.current['editor-1'];
    assert.match(color, /^hsl\(\d+, 90%, 50%\)$/);
    View(props);
    assert.equal(props.colorMapRef.current['editor-1'], color);
});
