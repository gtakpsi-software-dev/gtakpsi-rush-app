import { useCallback } from 'react';

// Create connected-socket commands for text, presence, and document synchronization.
export function useCollaborationCommands({
    socket,
    isConnected,
    currentUser,
    lastOperationRef,
    knownVersionsRef,
    pendingUpdatesRef,
}) {
    const sendTextOperation = useCallback((operation) => {
        // Remember and emit a text operation when connected.
        if (socket && isConnected) {
            // Preserve the original local-operation reference when a write is emitted.
            lastOperationRef.current = operation;
            socket.emit('text-operation', operation);
        }
    }, [socket, isConnected, lastOperationRef]);

    const sendTextUpdate = useCallback((field, value) => {
        // Track and emit a text update with its base version and unique client ID.
        if (socket && isConnected) {
            const baseVersion = knownVersionsRef.current[field] || 0;
            const clientUpdateId = Math.random().toString(36).substr(2, 9);
            pendingUpdatesRef.current[field] = { clientUpdateId, value };

            socket.emit('text-update', {
                field,
                value,
                baseVersion,
                clientUpdateId,
                userId: currentUser.id,
                userName: `${currentUser.firstName} ${currentUser.lastName}`
            });
        }
    }, [socket, isConnected, currentUser, knownVersionsRef, pendingUpdatesRef]);

    const sendCursorPosition = useCallback((field, position) => {
        // Broadcast the current cursor position and timestamp.
        if (socket && isConnected) {
            socket.emit('cursor-position', {
                field,
                position,
                timestamp: Date.now()
            });
        }
    }, [socket, isConnected]);

    const clearCursorPosition = useCallback((field) => {
        // Release cursor ownership for a field.
        if (socket && isConnected) {
            socket.emit('cursor-position', {
                field,
                position: null,
                timestamp: Date.now()
            });
        }
    }, [socket, isConnected]);

    const sendTypingIndicator = useCallback((field, isTyping) => {
        // Broadcast whether the current user is typing in a field.
        if (socket && isConnected) {
            socket.emit('typing-indicator', {
                field,
                isTyping,
                timestamp: Date.now()
            });
        }
    }, [socket, isConnected]);

    const requestDocumentState = useCallback(() => {
        // Request the room’s current document snapshot.
        if (socket && isConnected) {
            socket.emit('request-document-state');
        }
    }, [socket, isConnected]);

    return {
        sendTextOperation,
        sendTextUpdate,
        sendCursorPosition,
        clearCursorPosition,
        sendTypingIndicator,
        requestDocumentState,
    };
}
