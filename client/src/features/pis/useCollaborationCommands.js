import { useCallback } from 'react';

export function useCollaborationCommands({
    socket,
    isConnected,
    currentUser,
    lastOperationRef,
    knownVersionsRef,
    pendingUpdatesRef,
}) {
    const sendTextOperation = useCallback((operation) => {
        if (socket && isConnected) {
            // Preserve the original local-operation reference when a write is emitted.
            lastOperationRef.current = operation;
            socket.emit('text-operation', operation);
        }
    }, [socket, isConnected, lastOperationRef]);

    const sendTextUpdate = useCallback((field, value) => {
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
        if (socket && isConnected) {
            socket.emit('cursor-position', {
                field,
                position,
                timestamp: Date.now()
            });
        }
    }, [socket, isConnected]);

    const clearCursorPosition = useCallback((field) => {
        if (socket && isConnected) {
            socket.emit('cursor-position', {
                field,
                position: null,
                timestamp: Date.now()
            });
        }
    }, [socket, isConnected]);

    const sendTypingIndicator = useCallback((field, isTyping) => {
        if (socket && isConnected) {
            socket.emit('typing-indicator', {
                field,
                isTyping,
                timestamp: Date.now()
            });
        }
    }, [socket, isConnected]);

    const requestDocumentState = useCallback(() => {
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
