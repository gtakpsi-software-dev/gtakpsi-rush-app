import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { realtimeBaseUrls } from '../../config/realtimeBaseUrls.js';
import { registerCollaborationConnectionEvents } from './registerCollaborationConnectionEvents.js';
import { registerCollaborationFieldEvents } from './registerCollaborationFieldEvents.js';
import { registerCollaborationTextEvents } from './registerCollaborationTextEvents.js';
import { useCollaborationCommands } from './useCollaborationCommands.js';
import {
    pruneTypingUsers,
    clearStaleCursors,
    getActiveCursors,
} from './collaborationPresence.js';

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

    const {
        sendTextOperation,
        sendTextUpdate,
        sendCursorPosition,
        clearCursorPosition,
        sendTypingIndicator,
        requestDocumentState,
    } = useCollaborationCommands({
        socket,
        isConnected,
        currentUser,
        lastOperationRef,
        knownVersionsRef,
        pendingUpdatesRef,
    });

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
