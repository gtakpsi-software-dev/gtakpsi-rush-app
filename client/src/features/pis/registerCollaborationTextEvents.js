import {
    acceptRemoteTextUpdate,
    acknowledgeTextUpdate,
    rejectTextUpdate,
} from './collaborationProtocol.js';

// Register remote text operations, updates, acknowledgements, and rejection handling.
export function registerCollaborationTextEvents({
    socket,
    socketRef,
    currentUser,
    knownVersionsRef,
    pendingUpdatesRef,
    resendingFieldsRef,
    setRemoteOperations,
    setRemoteUpdates,
}) {
    socket.on('text-operation', (operation) => {
        // Ignore local text-operation echoes and append remote operations.
        if (operation.userId === currentUser?.id) {
            return;
        }

        setRemoteOperations((previous) => {
            // Deduplicate operations and retain only the latest fifty.
            // Bound operation history and ignore duplicate delivery so edits cannot replay.
            const exists = previous.some(/* Check whether this operation ID was already received. */ (item) => item.id === operation.id);
            if (exists) {
                return previous;
            }

            const next = [...previous, operation];
            return next.length > 50 ? next.slice(-50) : next;
        });
    });

    socket.on('text-update', (data) => {
        // Accept a newer remote text value and append it to update history.
        const update = acceptRemoteTextUpdate(
            data, currentUser.id, knownVersionsRef.current, resendingFieldsRef.current
        );
        if (update) {
            setRemoteUpdates(
                /* Append the accepted update while retaining only the latest hundred. */
                (previous) => [...previous, update].slice(-100));
        }
    });

    socket.on('text-ack', (ack) => {
        // Acknowledge the matching pending local text update.
        acknowledgeTextUpdate(
            ack, knownVersionsRef.current, pendingUpdatesRef.current, resendingFieldsRef.current
        );
    });

    socket.on('text-reject', (rejection) => {
        // Resend a rebased local value or append the server’s replacement value.
        const result = rejectTextUpdate(
            rejection, currentUser, knownVersionsRef.current,
            pendingUpdatesRef.current, resendingFieldsRef.current
        );
        // A rejected write either rebases the pending local value or shows the server value.
        if (result.resend) {
            socketRef.current.emit('text-update', result.resend);
        } else {
            setRemoteUpdates(
                /* Append the server replacement while retaining only the latest hundred. */
                (previous) => [...previous, result.remoteUpdate].slice(-100));
        }
    });
}
