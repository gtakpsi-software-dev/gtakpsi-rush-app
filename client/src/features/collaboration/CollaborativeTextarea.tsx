import { useRef, useState, useEffect, useCallback } from 'react';
import type { ChangeEvent, CompositionEvent, SyntheticEvent } from 'react';

import { activeCursorsForField } from './activeCursorsForField.js';
import CollaborativeTextareaView from './CollaborativeTextareaView';
import { reconcileRemoteFieldUpdate } from './reconcileRemoteFieldUpdate.js';
import { clearLocalChangeTimers, scheduleLocalChangeTimers } from './scheduleLocalChangeTimers.js';
import { syncPropValue } from './syncPropValue.js';
import { useCollaborativeFieldPresence } from './useCollaborativeFieldPresence';
import type { CollaborationEditorSession } from './CollaborationEditorSession';

type CollaborativeTextareaProps = {
    questionKey: string;
    value?: string;
    onChange: (questionKey: string, value: string, meta: { source: 'typing' | 'remote' }) => void;
    placeholder?: string;
    className?: string;
    collaboration: CollaborationEditorSession;
    currentUser?: unknown;
    disabled?: boolean;
};

const CollaborativeTextarea = ({ 
    questionKey, 
    value, 
    onChange, 
    placeholder, 
    className,
    collaboration,
    disabled = false
}: CollaborativeTextareaProps) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [localValue, setLocalValue] = useState(value || '');
    const [isComposing, setIsComposing] = useState(false);
    const lastSentValue = useRef(value || '');
    const processingRemoteOp = useRef(false);
    const colorMapRef = useRef<Record<string, string>>({});
    const pendingLocalChangeRef = useRef(false);
    const pendingLocalChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastLocalInputTimeRef = useRef(0);
    const lastProcessedVersionRef = useRef(0);
    
    const handleTextChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
        if (processingRemoteOp.current) {
            return;
        }
        
        const newValue = e.target.value;
        
        setLocalValue(newValue);
        pendingLocalChangeRef.current = true; // mark that this tab initiated a change
        lastLocalInputTimeRef.current = Date.now();
        onChange(questionKey, newValue, { source: 'typing' });
        
        scheduleLocalChangeTimers({
            pendingLocalChangeRef,
            pendingLocalChangeTimeoutRef,
            debounceTimerRef,
            collaboration,
            fieldKey: questionKey,
            value: newValue,
            lastSentValueRef: lastSentValue,
            debounceMs: 450,
            allowSend: !isComposing,
            schedule: setTimeout,
            cancel: clearTimeout,
        });
    }, [questionKey, onChange, collaboration, isComposing]);

    const handleCursorChange = useCallback((e: SyntheticEvent<HTMLTextAreaElement>) => {
        if (!processingRemoteOp.current) {
            collaboration.sendCursorPosition(questionKey, (e.target as HTMLTextAreaElement).selectionStart);
        }
    }, [questionKey, collaboration]);

    const handleCompositionStart = useCallback(() => {
        setIsComposing(true);
    }, []);

    const handleCompositionEnd = useCallback((e: CompositionEvent<HTMLTextAreaElement>) => {
        setIsComposing(false);
        if (collaboration.isConnected) {
            collaboration.sendTextUpdate(questionKey, (e.target as HTMLTextAreaElement).value);
            lastSentValue.current = (e.target as HTMLTextAreaElement).value;
        }
    }, [collaboration, questionKey]);

    const otherUserCursors = activeCursorsForField(collaboration, questionKey, 3);
    
    // Lock the field if any other user's cursor is in this field (strong lock)
    const isFieldLocked = otherUserCursors.length > 0;

    const { handleFocus, handleBlur, handleMouseDown } = useCollaborativeFieldPresence({
        fieldKey: questionKey, collaboration, fieldRef: textareaRef,
        lastSentValueRef: lastSentValue, localValue, isFieldLocked,
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
    }, [value, collaboration, questionKey]);

    useEffect(() => {
        return reconcileRemoteFieldUpdate({
            remoteUpdates: collaboration.remoteUpdates,
            fieldKey: questionKey,
            localValue,
            lastProcessedVersionRef,
            lastLocalInputTimeRef,
            processingRemoteOpRef: processingRemoteOp,
            pendingLocalChangeRef,
            lastSentValueRef: lastSentValue,
            setLocalValue,
            onRemoteChange: (nextValue) => onChange(questionKey, nextValue, { source: 'remote' }),
            deferMs: 650,
        });
    }, [collaboration.remoteUpdates, questionKey, localValue, onChange]);

    useEffect(() => {
        return () => {
            clearLocalChangeTimers({
                debounceTimerRef, pendingLocalChangeTimeoutRef, cancel: clearTimeout,
            });
        };
    }, []);

    return <CollaborativeTextareaView {...{
        textareaRef, colorMapRef, className, placeholder, localValue,
        disabled, isFieldLocked, isConnected: collaboration.isConnected,
        otherUserCursors, handleTextChange, handleCursorChange, handleFocus,
        handleBlur, handleMouseDown, handleCompositionStart, handleCompositionEnd,
    }} />;
};

export default CollaborativeTextarea;
