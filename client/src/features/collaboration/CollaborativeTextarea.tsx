import { useRef, useState, useEffect, useCallback } from 'react';
import type { ChangeEvent, CompositionEvent, FocusEvent, MouseEvent, SyntheticEvent } from 'react';

import { activeCursorsForField } from './activeCursorsForField.js';
import CollaborativeTextareaView from './CollaborativeTextareaView';
import { reconcileRemoteFieldUpdate } from './reconcileRemoteFieldUpdate.js';
import { syncPropValue } from './syncPropValue.js';
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
    const processedOperations = useRef(new Set());
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
        
        // Clear any existing pending timeout and set a new one
        // This ensures pendingLocalChangeRef doesn't stay stuck forever
        if (pendingLocalChangeTimeoutRef.current) {
            clearTimeout(pendingLocalChangeTimeoutRef.current);
        }
        pendingLocalChangeTimeoutRef.current = setTimeout(() => {
            pendingLocalChangeRef.current = false;
        }, 2000); // Force clear after 2 seconds max
        
        if (!isComposing && collaboration.isConnected) {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
                collaboration.sendTextUpdate(questionKey, newValue);
                lastSentValue.current = newValue;
            }, 450);
        }
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

    const typingInThisField = collaboration.typingUsers.filter(user => user.field === questionKey);
    
    const otherUserCursors = activeCursorsForField(collaboration, questionKey, 3);
    
    // Lock the field if any other user's cursor is in this field (strong lock)
    const isFieldLocked = otherUserCursors.length > 0;

    const handleFocus = useCallback((e: FocusEvent<HTMLTextAreaElement>) => {
        // Prevent focus if another user is actively in this field
        if (isFieldLocked) {
            (e.target as HTMLTextAreaElement).blur();
            return;
        }
        collaboration.sendTypingIndicator(questionKey, true);
        const pos = typeof (e?.target as HTMLTextAreaElement)?.selectionStart === 'number'
            ? (e.target as HTMLTextAreaElement).selectionStart
            : 0;
        collaboration.sendCursorPosition(questionKey, pos);
    }, [collaboration, questionKey, isFieldLocked]);

    const handleBlur = useCallback(() => {
        // stop typing indicator and flush any pending local value
        collaboration.sendTypingIndicator(questionKey, false);
        // Clear cursor position to release field lock for other users
        if (collaboration.clearCursorPosition) {
            collaboration.clearCursorPosition(questionKey);
        }
        if (collaboration.isConnected) {
            const valueToFlush = typeof textareaRef.current?.value === 'string' ? textareaRef.current.value : localValue;
            collaboration.sendTextUpdate(questionKey, valueToFlush);
            lastSentValue.current = valueToFlush;
        }
    }, [collaboration, questionKey, localValue]);

    // Prevent mouse clicks from focusing when field is locked
    const handleMouseDown = useCallback((e: MouseEvent<HTMLTextAreaElement>) => {
        if (isFieldLocked) {
            e.preventDefault();
        }
    }, [isFieldLocked]);

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
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            if (pendingLocalChangeTimeoutRef.current) clearTimeout(pendingLocalChangeTimeoutRef.current);
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
