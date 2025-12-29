import React, { useRef, useState, useEffect, useCallback } from 'react';

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
    const debounceTimerRef = useRef(null);
    const lastLocalInputTimeRef = useRef(0);
    
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

    // Get cursor information for other users in this field
    const otherUserCursors = collaboration.connectedUsers
        .filter(user => user.field === fieldKey && typeof user.cursor === 'number');
    
    // Lock the field if any other user's cursor is in this field
    const isFieldLocked = otherUserCursors.length > 0;
    
    // Get user name who has the field locked
    const lockedByUser = otherUserCursors.length > 0 
        ? `${otherUserCursors[0].firstName || 'Another user'}` 
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

    // Listen for remote updates
    useEffect(() => {
        const latest = [...collaboration.remoteUpdates].reverse().find(u => u.field === fieldKey);
        if (!latest) return;
        if (latest.value === localValue) return;

        const applyRemote = () => {
            processingRemoteOp.current = true;
            setLocalValue(latest.value);
            onChange(latest.value);
            lastSentValue.current = latest.value;
            setTimeout(() => processingRemoteOp.current = false, 0);
        };

        const now = Date.now();
        if (now - lastLocalInputTimeRef.current < 500) {
            const to = setTimeout(() => {
                applyRemote();
            }, 500);
            return () => clearTimeout(to);
        } else {
            applyRemote();
        }
    }, [collaboration.remoteUpdates, fieldKey, localValue, onChange]);

    return (
        <div className="relative">
            <input
                ref={inputRef}
                type="text"
                className={`${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${isFieldLocked ? 'cursor-not-allowed bg-blue-50' : ''}`}
                placeholder={placeholder}
                value={localValue}
                onChange={handleTextChange}
                onSelect={handleCursorChange}
                onClick={handleCursorChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onMouseDown={handleMouseDown}
                disabled={disabled}
                required={required}
            />
            
            {/* Field locked indicator */}
            {isFieldLocked && (
                <div className="absolute inset-0 bg-blue-50/50 border-2 border-blue-300 rounded-apple pointer-events-none flex items-center justify-center">
                    <div className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium shadow-sm whitespace-nowrap">
                        {lockedByUser} is typing
                    </div>
                </div>
            )}
        </div>
    );
};

export default CollaborativeInput;

