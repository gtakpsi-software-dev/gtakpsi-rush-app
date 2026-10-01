import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { realtimeBaseUrls } from '../config/realtimeBaseUrls.js';
import { normalizeDocumentState } from '../features/pis/collaborationProtocol.js';
import { registerCollaborationTextEvents } from '../features/pis/registerCollaborationTextEvents.js';
import {
    applyCursorPosition,
    applyTypingIndicator,
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

            socketRef.current.on('connect', () => {
                setIsConnected(true);
                
                // Join the room
                socketRef.current.emit('join-room', {
                    roomId,
                    userId: currentUser.id,
                    userName: `${currentUser.firstName} ${currentUser.lastName}`,
                });
            });

            socketRef.current.on('disconnect', () => {
                setIsConnected(false);
                
                // Attempt to reconnect after 3 seconds
                reconnectTimeoutRef.current = setTimeout(() => {
                    if (!socketRef.current?.connected) {
                        connectSocket();
                    }
                }, 3000);
            });

            socketRef.current.on('connect_error', () => {
                setIsConnected(false);
            });

            socketRef.current.on('users-updated', (users) => {
                setConnectedUsers(users.filter(user => user.id !== currentUser.id));
            });

            socketRef.current.on('text-operation', (operation) => {
                // Avoid processing our own operations
                if (operation.userId === currentUser?.id) {
                    return;
                }
                
                setRemoteOperations(prev => {
                    // Avoid duplicate operations
                    const exists = prev.some(op => op.id === operation.id);
                    if (exists) {
                        return prev;
                    }
                    
                    // Keep only the last 50 operations to prevent memory issues
                    const newOps = [...prev, operation];
                    return newOps.length > 50 ? newOps.slice(-50) : newOps;
                });
            });

            registerCollaborationTextEvents({
                socket: socketRef.current,
                socketRef,
                currentUser,
                knownVersionsRef,
                pendingUpdatesRef,
                resendingFieldsRef,
                setRemoteUpdates,
            });

            socketRef.current.on('cursor-position', (data) => {
                if (data.userId === currentUser.id) return;

                setConnectedUsers(prev => applyCursorPosition(prev, data));
            });

            socketRef.current.on('typing-indicator', (data) => {
                if (data.userId === currentUser.id) return;

                setTypingUsers(prev => applyTypingIndicator(prev, data));
            });

            socketRef.current.on('document-state', (state) => {
                const { values, versions } = normalizeDocumentState(state);
                setDocumentState(values);
                setDocumentVersions(versions);
                knownVersionsRef.current = versions;
            });

            setSocket(socketRef.current);
        };

        connectSocket();

        return () => {
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
