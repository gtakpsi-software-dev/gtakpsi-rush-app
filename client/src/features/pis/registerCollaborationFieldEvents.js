import { normalizeDocumentState } from './collaborationProtocol.js';
import { applyCursorPosition, applyTypingIndicator } from './collaborationPresence.js';

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
        // Ignore our own presence echoes so local focus does not become a remote field lock.
        if (data.userId === currentUser.id) return;

        setConnectedUsers((previous) => applyCursorPosition(previous, data));
    });

    socket.on('typing-indicator', (data) => {
        if (data.userId === currentUser.id) return;

        setTypingUsers((previous) => applyTypingIndicator(previous, data));
    });

    socket.on('document-state', (state) => {
        const { values, versions } = normalizeDocumentState(state);
        setDocumentState(values);
        setDocumentVersions(versions);
        knownVersionsRef.current = versions;
    });
}
