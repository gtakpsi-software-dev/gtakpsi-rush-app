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

// Manage the PIS socket, remote document state, text updates, and collaborator presence.
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
        // Connect a valid room and user when no socket is already registered.
        if (!roomId || !currentUser || !currentUser.id) {
            return;
        }

        if (socketRef.current) {
            return;
        }

        // Create a socket and attach room, presence, and text synchronization handlers.
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
                // Replace the connected-user list with remote collaborators.
                setConnectedUsers(users.filter(/* Exclude the current user from the remote-user list. */ user => user.id !== currentUser.id));
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
            // Cancel reconnect work, disconnect the socket, and remove listeners.
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
        // Start periodic cleanup of expired typing indicators and cursors.
        const interval = setInterval(() => {
            // Prune stale presence using the current timestamp.
            const now = Date.now();

            setTypingUsers(/* Remove expired typing indicators. */ prev => pruneTypingUsers(prev, now));
            setConnectedUsers(/* Clear expired cursor ownership. */ prev => clearStaleCursors(prev, now));
        }, 1000);

        return /* Stop the presence-cleanup interval. */ () => clearInterval(interval);
    }, []);

    const getActiveCursorsForField = useCallback((field) => {
        // Return active remote cursors for the requested field.
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
