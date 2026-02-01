import React, { useRef, useState, useEffect, useCallback } from 'react';
import getCaretCoordinates from 'textarea-caret';

const getRandomColor = () => `hsl(${Math.floor(Math.random()*360)}, 90%, 50%)`;

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
    const otherUserCursors = collaboration.getActiveCursorsForField 
        ? collaboration.getActiveCursorsForField(questionKey).slice(0, 3) // Limit to 3 cursors to avoid UI clutter
        : collaboration.connectedUsers
            .filter(user => user.field === questionKey && typeof user.cursor === 'number')
            .slice(0, 3);
    
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

    return (
        <div className="relative">
            <textarea
                ref={textareaRef}
                className={`${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${isFieldLocked ? 'cursor-not-allowed' : ''}`}
                placeholder={placeholder}
                value={localValue}
                onChange={handleTextChange}
                onSelect={handleCursorChange}
                onClick={handleCursorChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onMouseDown={handleMouseDown}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                disabled={disabled}
            />
            
            {/* Field locked overlay */}
            {isFieldLocked && (
                <div className="absolute inset-0 bg-blue-50/30 border-2 border-blue-300 rounded-md pointer-events-none flex items-center justify-center">
                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium shadow-sm">
                        {otherUserCursors[0]?.name || 'Another user'} is editing
                    </div>
                </div>
            )}
            
            {/* Connection status indicator */}
            {!collaboration.isConnected && (
                <div className="absolute top-2 right-2 flex items-center space-x-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-xs text-gray-500">Offline</span>
                </div>
            )}
            

            
            {/* Other users' cursors */}
            {otherUserCursors.map((user, index) => {
                 // Calculate approximate cursor position using textarea-caret
                 let leftOffset = 0;
                 let topOffset = 0;
                 if (textareaRef.current) {
                     const coords = getCaretCoordinates(textareaRef.current, user.cursor);
                     leftOffset = coords.left;
                     topOffset = coords.top;
                 }
                 
                 // Assign or retrieve a truly random color per user for this session
                 if (!colorMapRef.current[user.id]) {
                     colorMapRef.current[user.id] = getRandomColor();
                 }
                 const colorStyle = colorMapRef.current[user.id];
                 
                 return (
                     <div
                         key={user.id}
                         className="absolute pointer-events-none z-10"
                         style={{
                             left: `${leftOffset}px`,
                             top: `${topOffset}px`,
                         }}
                     >
                        <div className="w-0.5 h-5 animate-pulse" style={{ backgroundColor: colorStyle }} />
                     </div>
                 );
             })}
        </div>
    );
};

export default CollaborativeTextarea; 