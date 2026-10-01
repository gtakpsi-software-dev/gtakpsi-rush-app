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
    setRemoteUpdates,
}) {
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
