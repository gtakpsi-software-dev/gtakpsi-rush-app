import { useRef, useState, useEffect, useCallback } from 'react';
import { activeCursorsForField } from '../features/collaboration/activeCursorsForField.js';
import CollaborativeInputView from '../features/collaboration/CollaborativeInputView';
import { reconcileRemoteFieldUpdate } from '../features/collaboration/reconcileRemoteFieldUpdate.js';

const CollaborativeInput = ({ 
    fieldKey, 
    value, 
    onChange, 
    placeholder, 
    className,
    collaboration,
    currentUser,
    disabled = false,
    required = false
}) => {
    const inputRef = useRef(null);
    const [localValue, setLocalValue] = useState(value || '');
    const lastSentValue = useRef(value || '');
    const processingRemoteOp = useRef(false);
    const pendingLocalChangeRef = useRef(false);
    const pendingLocalChangeTimeoutRef = useRef(null);
    const debounceTimerRef = useRef(null);
    const lastLocalInputTimeRef = useRef(0);
    const lastProcessedVersionRef = useRef(0);
    
    // Handle local text changes
    const handleTextChange = useCallback((e) => {
        if (processingRemoteOp.current) {
            return;
        }
        
        const newValue = e.target.value;
        
        setLocalValue(newValue);
        pendingLocalChangeRef.current = true;
        lastLocalInputTimeRef.current = Date.now();
        onChange(newValue);
        
        // Clear any existing pending timeout and set a new one
        // This ensures pendingLocalChangeRef doesn't stay stuck forever
        if (pendingLocalChangeTimeoutRef.current) {
            clearTimeout(pendingLocalChangeTimeoutRef.current);
        }
        pendingLocalChangeTimeoutRef.current = setTimeout(() => {
            pendingLocalChangeRef.current = false;
        }, 2000); // Force clear after 2 seconds max
        
        if (collaboration.isConnected) {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
                collaboration.sendTextUpdate(fieldKey, newValue);
                lastSentValue.current = newValue;
            }, 300);
        }
    }, [fieldKey, onChange, collaboration]);

    // Handle cursor position changes
    const handleCursorChange = useCallback(() => {
        if (!processingRemoteOp.current && inputRef.current) {
            collaboration.sendCursorPosition(fieldKey, inputRef.current.selectionStart);
        }
    }, [fieldKey, collaboration]);

    // Get cursor information for other users in this field (with staleness filtering)
    const otherUserCursors = activeCursorsForField(collaboration, fieldKey);
    
    // Lock the field if any other user's cursor is in this field
    const isFieldLocked = otherUserCursors.length > 0;
    
    // Get user name who has the field locked
    const lockedByUser = otherUserCursors.length > 0 
        ? `${otherUserCursors[0].name || otherUserCursors[0].firstName || 'Another user'}` 
        : null;

    // Handle focus events
    const handleFocus = useCallback((e) => {
        // Prevent focus if another user is actively in this field
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
        // Clear cursor position to release field lock for other users
        if (collaboration.clearCursorPosition) {
            collaboration.clearCursorPosition(fieldKey);
        }
        if (collaboration.isConnected) {
            const valueToFlush = typeof inputRef.current?.value === 'string' ? inputRef.current.value : localValue;
            collaboration.sendTextUpdate(fieldKey, valueToFlush);
            lastSentValue.current = valueToFlush;
        }
    }, [collaboration, fieldKey, localValue]);

    // Prevent mouse clicks from focusing when field is locked
    const handleMouseDown = useCallback((e) => {
        if (isFieldLocked) {
            e.preventDefault();
        }
    }, [isFieldLocked]);

    // Sync with prop value changes
    useEffect(() => {
        if (processingRemoteOp.current) return;

        if (pendingLocalChangeRef.current) {
            if (value === localValue) {
                pendingLocalChangeRef.current = false;
            }
            return;
        }

        if (value !== localValue) {
            const newValue = value || '';
            setLocalValue(newValue);
            lastSentValue.current = newValue;
        }
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

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            if (pendingLocalChangeTimeoutRef.current) clearTimeout(pendingLocalChangeTimeoutRef.current);
        };
    }, []);

    return <CollaborativeInputView {...{
        inputRef, className, placeholder, localValue, disabled, required,
        isFieldLocked, lockedByUser, handleTextChange, handleCursorChange,
        handleFocus, handleBlur, handleMouseDown,
    }} />;
};

export default CollaborativeInput;
