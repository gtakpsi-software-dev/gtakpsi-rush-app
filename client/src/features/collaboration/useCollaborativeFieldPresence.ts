import { useCallback } from 'react';
import type { FocusEvent, MouseEvent, MutableRefObject, RefObject } from 'react';

import type { CollaborationEditorSession } from './CollaborationEditorSession';

type CollaborativeFieldPresenceOptions<T extends HTMLInputElement | HTMLTextAreaElement> = {
    fieldKey: string;
    collaboration: CollaborationEditorSession;
    fieldRef: RefObject<T>;
    lastSentValueRef: MutableRefObject<string>;
    localValue: string;
    isFieldLocked: boolean;
};

export function useCollaborativeFieldPresence<T extends HTMLInputElement | HTMLTextAreaElement>({
    fieldKey,
    collaboration,
    fieldRef,
    lastSentValueRef,
    localValue,
    isFieldLocked,
}: CollaborativeFieldPresenceOptions<T>) {
    const handleFocus = useCallback((e: FocusEvent<T>) => {
        // INVARIANT: a remote cursor owns the field until that user's presence clears.
        if (isFieldLocked) {
            e.target.blur();
            return;
        }
        collaboration.sendTypingIndicator(fieldKey, true);
        const pos = typeof e?.target?.selectionStart === 'number' ? e.target.selectionStart : 0;
        collaboration.sendCursorPosition(fieldKey, pos);
    }, [collaboration, fieldKey, isFieldLocked]);

    const handleBlur = useCallback(() => {
        collaboration.sendTypingIndicator(fieldKey, false);
        // Release the remote lock before flushing the current DOM value.
        if (collaboration.clearCursorPosition) {
            collaboration.clearCursorPosition(fieldKey);
        }
        if (collaboration.isConnected) {
            const valueToFlush = typeof fieldRef.current?.value === 'string' ? fieldRef.current.value : localValue;
            collaboration.sendTextUpdate(fieldKey, valueToFlush);
            lastSentValueRef.current = valueToFlush;
        }
    }, [collaboration, fieldKey, localValue, fieldRef, lastSentValueRef]);

    const handleMouseDown = useCallback((e: MouseEvent<T>) => {
        if (isFieldLocked) {
            e.preventDefault();
        }
    }, [isFieldLocked]);

    return { handleFocus, handleBlur, handleMouseDown };
}
