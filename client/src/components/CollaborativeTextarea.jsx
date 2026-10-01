import { useRef, useState, useEffect, useCallback } from 'react';
import { activeCursorsForField } from '../features/collaboration/activeCursorsForField.js';
import CollaborativeTextareaView from '../features/collaboration/CollaborativeTextareaView';

const CollaborativeTextarea = ({ 
    questionKey, 
    value, 
    onChange, 
    placeholder, 
    className,
    collaboration,
    currentUser,
    disabled = false
}) => {
    const textareaRef = useRef(null);
    const [localValue, setLocalValue] = useState(value || '');
    const [isComposing, setIsComposing] = useState(false);
    const lastSentValue = useRef(value || '');
    const processingRemoteOp = useRef(false);
    const processedOperations = useRef(new Set());
    const colorMapRef = useRef({});
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

    // Handle cursor position changes
    const handleCursorChange = useCallback((e) => {
        if (!processingRemoteOp.current) {
            collaboration.sendCursorPosition(questionKey, e.target.selectionStart);
        }
    }, [questionKey, collaboration]);

    // Handle composition events (for international keyboards)
    const handleCompositionStart = useCallback(() => {
        setIsComposing(true);
    }, []);

    const handleCompositionEnd = useCallback((e) => {
        setIsComposing(false);
        // Send any pending text update after composition ends
        if (collaboration.isConnected) {
            collaboration.sendTextUpdate(questionKey, e.target.value);
            lastSentValue.current = e.target.value;
        }
    }, [collaboration, questionKey]);

    // Get typing indicators for this field
    const typingInThisField = collaboration.typingUsers.filter(user => user.field === questionKey);
    
    // Get cursor information for other users (with staleness filtering)
    const otherUserCursors = activeCursorsForField(collaboration, questionKey, 3);
    
    // Lock the field if any other user's cursor is in this field (strong lock)
    const isFieldLocked = otherUserCursors.length > 0;

    // Handle focus events for typing indicators
    const handleFocus = useCallback((e) => {
        // Prevent focus if another user is actively in this field
        if (isFieldLocked) {
            e.target.blur(); // Immediately remove focus
            return;
        }
        collaboration.sendTypingIndicator(questionKey, true);
        const pos = typeof e?.target?.selectionStart === 'number' ? e.target.selectionStart : 0;
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
    const handleMouseDown = useCallback((e) => {
        if (isFieldLocked) {
            e.preventDefault();
        }
    }, [isFieldLocked]);

    // Sync with prop value changes (e.g., when another user updates or voice transcription adds text)
    useEffect(() => {
        if (processingRemoteOp.current) return; // skip during remote op

        // If we recently made a local change, wait until the prop matches localValue before clearing flag
        if (pendingLocalChangeRef.current) {
            if (value === localValue) {
                // prop has caught up, clear the flag
                pendingLocalChangeRef.current = false;
            }
            return; // don't overwrite while waiting
        }

        if (value !== localValue) {
            const newValue = value || '';
            setLocalValue(newValue);
            lastSentValue.current = newValue;
        }
    }, [value, collaboration, questionKey]);

    // new effect listen remoteUpdates (defer if user typed very recently to reduce jitter)
    useEffect(() => {
        const latest = [...collaboration.remoteUpdates].reverse().find(u => u.field === questionKey);
        if (!latest) return;
        
        // Skip if we've already processed this version or newer
        if (latest.version && latest.version <= lastProcessedVersionRef.current) return;
        
        // Skip if value is already the same
        if (latest.value === localValue) {
            if (latest.version) lastProcessedVersionRef.current = latest.version;
            return;
        }

        const applyRemote = () => {
            processingRemoteOp.current = true;
            setLocalValue(latest.value);
            onChange(questionKey, latest.value, { source: 'remote' });
            lastSentValue.current = latest.value;
            if (latest.version) lastProcessedVersionRef.current = latest.version;
            // Clear pending flag since we're accepting remote value
            pendingLocalChangeRef.current = false;
            setTimeout(() => processingRemoteOp.current = false, 0);
        };

        const now = Date.now();
        if (now - lastLocalInputTimeRef.current < 650) {
            const to = setTimeout(() => {
                applyRemote();
            }, 650);
            return () => clearTimeout(to);
        } else {
            applyRemote();
        }
    }, [collaboration.remoteUpdates, questionKey, localValue, onChange]);

    // Cleanup timers on unmount
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
