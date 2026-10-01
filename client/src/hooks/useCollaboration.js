import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { realtimeBaseUrls } from '../config/realtimeBaseUrls.js';
import { registerCollaborationConnectionEvents } from '../features/pis/registerCollaborationConnectionEvents.js';
import { registerCollaborationFieldEvents } from '../features/pis/registerCollaborationFieldEvents.js';
import { registerCollaborationTextEvents } from '../features/pis/registerCollaborationTextEvents.js';
import {
    pruneTypingUsers,
    clearStaleCursors,
    getActiveCursors,
} from '../features/pis/collaborationPresence.js';

export const useCollaboration = (roomId, currentUser) => {
    const [socket, setSocket] = useState(null);
    const [connectedUsers, setConnectedUsers] = useState([]);
    const [remoteOperations, setRemoteOperations] = useState([]);
    const [remoteUpdates, setRemoteUpdates] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [typingUsers, setTypingUsers] = useState(new Map());
    const [documentState, setDocumentState] = useState({});
    const [documentVersions, setDocumentVersions] = useState({});
    
    const lastOperationRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const socketRef = useRef(null);
    const knownVersionsRef = useRef({}); // field -> version number
    const pendingUpdatesRef = useRef({}); // field -> { clientUpdateId, value }
    const resendingFieldsRef = useRef(new Set()); // tracks fields currently being resent after reject

    const pisCollaborationUrl = realtimeBaseUrls.pisCollaboration;

    useEffect(() => {
        if (!roomId || !currentUser || !currentUser.id) {
            return;
        }

        if (socketRef.current) {
            return;
        }

        const connectSocket = () => {
            socketRef.current = io(pisCollaborationUrl, {
                forceNew: true,
            });

            registerCollaborationConnectionEvents({
                socket: socketRef.current,
                socketRef,
                reconnectTimeoutRef,
                roomId,
                currentUser,
                setIsConnected,
                reconnect: connectSocket,
            });

            socketRef.current.on('users-updated', (users) => {
                setConnectedUsers(users.filter(user => user.id !== currentUser.id));
            });

            registerCollaborationTextEvents({
                socket: socketRef.current,
                socketRef,
                currentUser,
                knownVersionsRef,
                pendingUpdatesRef,
                resendingFieldsRef,
                setRemoteOperations,
                setRemoteUpdates,
            });

            registerCollaborationFieldEvents({
                socket: socketRef.current,
                currentUser,
                knownVersionsRef,
                setConnectedUsers,
                setTypingUsers,
                setDocumentState,
                setDocumentVersions,
            });

            setSocket(socketRef.current);
        };

        connectSocket();

        return () => {
            // The disconnect listener can schedule a retry after mount; clear its latest timer.
            // eslint-disable-next-line react-hooks/exhaustive-deps
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current.removeAllListeners();
                socketRef.current = null;
            }
        };
    }, [roomId, currentUser, pisCollaborationUrl]);

    const sendTextOperation = useCallback((operation) => {
        if (socket && isConnected) {
            // Store reference to avoid processing our own operation
            lastOperationRef.current = operation;
            socket.emit('text-operation', operation);
        }
    }, [socket, isConnected]);

    // Send full text update after debounce
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
    }, [socket, isConnected, currentUser]);

    const sendCursorPosition = useCallback((field, position) => {
        if (socket && isConnected) {
            socket.emit('cursor-position', {
                field,
                position,
                timestamp: Date.now()
            });
        }
    }, [socket, isConnected]);

    // Clear cursor position (call on blur to release field lock)
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

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();

            setTypingUsers(prev => pruneTypingUsers(prev, now));
            setConnectedUsers(prev => clearStaleCursors(prev, now));
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const getActiveCursorsForField = useCallback((field) => {
        return getActiveCursors(connectedUsers, field);
    }, [connectedUsers]);

    return {
        isConnected,
        connectedUsers,
        remoteOperations,
        remoteUpdates,
        typingUsers: Array.from(typingUsers.values()),
        documentState,
        documentVersions,
        sendTextOperation,
        sendTextUpdate,
        sendCursorPosition,
        clearCursorPosition,
        sendTypingIndicator,
        requestDocumentState,
        getActiveCursorsForField,
    };
};

export { applyOperation, createOperation, createOperationsFromDiff } from "../features/pis/operations.js";
