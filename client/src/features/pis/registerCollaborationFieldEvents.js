import { normalizeDocumentState } from './collaborationProtocol.js';
import { applyCursorPosition, applyTypingIndicator } from './collaborationPresence.js';

// Register remote cursor, typing, and full-document synchronization handlers.
export function registerCollaborationFieldEvents({
    socket,
    currentUser,
    knownVersionsRef,
    setConnectedUsers,
    setTypingUsers,
    setDocumentState,
    setDocumentVersions,
}) {
    socket.on('cursor-position', (data) => {
        // Apply another collaborator’s cursor update while ignoring local echoes.
        // Ignore our own presence echoes so local focus does not become a remote field lock.
        if (data.userId === currentUser.id) return;

        setConnectedUsers(/* Merge the received cursor into the connected-user list. */ (previous) => applyCursorPosition(previous, data));
    });

    socket.on('typing-indicator', (data) => {
        // Apply another collaborator’s typing state while ignoring local echoes.
        if (data.userId === currentUser.id) return;

        setTypingUsers(/* Merge or remove the received typing indicator. */ (previous) => applyTypingIndicator(previous, data));
    });

    socket.on('document-state', (state) => {
        // Normalize the document snapshot and replace known values and versions.
        const { values, versions } = normalizeDocumentState(state);
        setDocumentState(values);
        setDocumentVersions(versions);
        knownVersionsRef.current = versions;
    });
}
