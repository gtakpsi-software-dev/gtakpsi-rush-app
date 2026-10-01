import {
    acceptRemoteTextUpdate,
    acknowledgeTextUpdate,
    rejectTextUpdate,
} from './collaborationProtocol.js';

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
        if (operation.userId === currentUser?.id) {
            return;
        }

        setRemoteOperations((previous) => {
            // Bound operation history and ignore duplicate delivery so edits cannot replay.
            const exists = previous.some((item) => item.id === operation.id);
            if (exists) {
                return previous;
            }

            const next = [...previous, operation];
            return next.length > 50 ? next.slice(-50) : next;
        });
    });

    socket.on('text-update', (data) => {
        const update = acceptRemoteTextUpdate(
            data, currentUser.id, knownVersionsRef.current, resendingFieldsRef.current
        );
        if (update) {
            setRemoteUpdates((previous) => [...previous, update].slice(-100));
        }
    });

    socket.on('text-ack', (ack) => {
        acknowledgeTextUpdate(
            ack, knownVersionsRef.current, pendingUpdatesRef.current, resendingFieldsRef.current
        );
    });

    socket.on('text-reject', (rejection) => {
        const result = rejectTextUpdate(
            rejection, currentUser, knownVersionsRef.current,
            pendingUpdatesRef.current, resendingFieldsRef.current
        );
        // A rejected write either rebases the pending local value or shows the server value.
        if (result.resend) {
            socketRef.current.emit('text-update', result.resend);
        } else {
            setRemoteUpdates((previous) => [...previous, result.remoteUpdate].slice(-100));
        }
    });
}
