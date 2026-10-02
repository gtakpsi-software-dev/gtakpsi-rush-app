import { useRef, useState, useEffect, useCallback } from 'react';
import type { ChangeEvent } from 'react';

import { activeCursorsForField } from './activeCursorsForField.js';
import CollaborativeInputView from './CollaborativeInputView';
import { reconcileRemoteFieldUpdate } from './reconcileRemoteFieldUpdate.js';
import { clearLocalChangeTimers, scheduleLocalChangeTimers } from './scheduleLocalChangeTimers.js';
import { syncPropValue } from './syncPropValue.js';
import { useCollaborativeFieldPresence } from './useCollaborativeFieldPresence';
import type { CollaborationEditorSession } from './CollaborationEditorSession';

type CollaborativeInputProps = {
    fieldKey: string;
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    collaboration: CollaborationEditorSession;
    currentUser?: unknown;
    disabled?: boolean;
    required?: boolean;
};

const CollaborativeInput = ({
    fieldKey,
    value,
    onChange,
    placeholder,
    className,
    collaboration,
    disabled = false,
    required = false,
}: CollaborativeInputProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [localValue, setLocalValue] = useState(value || '');
    const lastSentValue = useRef(value || '');
    const processingRemoteOp = useRef(false);
    const pendingLocalChangeRef = useRef(false);
    const pendingLocalChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastLocalInputTimeRef = useRef(0);
    const lastProcessedVersionRef = useRef(0);

    const handleTextChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        if (processingRemoteOp.current) {
            return;
        }

        const newValue = e.target.value;

        setLocalValue(newValue);
        pendingLocalChangeRef.current = true;
        lastLocalInputTimeRef.current = Date.now();
        onChange(newValue);

        scheduleLocalChangeTimers({
            pendingLocalChangeRef,
            pendingLocalChangeTimeoutRef,
            debounceTimerRef,
            collaboration,
            fieldKey,
            value: newValue,
            lastSentValueRef: lastSentValue,
            debounceMs: 300,
            allowSend: true,
            schedule: setTimeout,
            cancel: clearTimeout,
        });
    }, [fieldKey, onChange, collaboration]);

    const handleCursorChange = useCallback(() => {
        if (!processingRemoteOp.current && inputRef.current) {
            collaboration.sendCursorPosition(fieldKey, inputRef.current.selectionStart);
        }
    }, [fieldKey, collaboration]);

    const otherUserCursors = activeCursorsForField(collaboration, fieldKey);
    const isFieldLocked = otherUserCursors.length > 0;

    const lockedByUser = otherUserCursors.length > 0
        ? `${otherUserCursors[0].name || otherUserCursors[0].firstName || 'Another user'}`
        : null;

    const { handleFocus, handleBlur, handleMouseDown } = useCollaborativeFieldPresence({
        fieldKey, collaboration, fieldRef: inputRef, lastSentValueRef: lastSentValue,
        localValue, isFieldLocked,
    });

    useEffect(() => {
        syncPropValue({
            value,
            localValue,
            processingRemoteOpRef: processingRemoteOp,
            pendingLocalChangeRef,
            setLocalValue,
            lastSentValueRef: lastSentValue,
        });
    }, [value, localValue]);

    useEffect(() => {
        return reconcileRemoteFieldUpdate({
            remoteUpdates: collaboration.remoteUpdates,
            fieldKey,
            localValue,
            lastProcessedVersionRef,
            lastLocalInputTimeRef,
            processingRemoteOpRef: processingRemoteOp,
            pendingLocalChangeRef,
            lastSentValueRef: lastSentValue,
            setLocalValue,
            onRemoteChange: (nextValue) => onChange(nextValue),
            deferMs: 500,
        });
    }, [collaboration.remoteUpdates, fieldKey, localValue, onChange]);

    useEffect(() => {
        return () => {
            clearLocalChangeTimers({
                debounceTimerRef, pendingLocalChangeTimeoutRef, cancel: clearTimeout,
            });
        };
    }, []);

    return <CollaborativeInputView {...{
        inputRef, className, placeholder, localValue, disabled, required,
        isFieldLocked, lockedByUser, handleTextChange, handleCursorChange,
        handleFocus, handleBlur, handleMouseDown,
    }} />;
};

export default CollaborativeInput;
