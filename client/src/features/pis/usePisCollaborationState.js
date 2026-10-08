import { useEffect } from 'react';

import { useCollaboration } from './useCollaboration';
import { applyDocumentState, applyRemoteUpdates } from './collaborationState';

// Connect the interview room and apply document snapshots and live updates to page state.
export function usePisCollaborationState({
    gtid,
    currentUser,
    setBrotherA,
    setBrotherB,
    setAnswers,
}) {
    const collaboration = useCollaboration(`pis-${gtid}`, currentUser);

    useEffect(() => {
        // Request the current document whenever the connection becomes active.
        if (collaboration.isConnected) {
            collaboration.requestDocumentState();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- Request only when connection status changes, as in the original page.
    }, [collaboration.isConnected]);

    useEffect(() => {
        // Hydrate interviewer names and answers from the latest document snapshot.
        applyDocumentState(collaboration.documentState, { setBrotherA, setBrotherB, setAnswers });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- Parent state setters are stable and did not trigger document reapplication.
    }, [collaboration.documentState]);

    useEffect(() => {
        // Apply the latest remote field update to interview state.
        applyRemoteUpdates(collaboration.remoteUpdates, { setBrotherA, setBrotherB, setAnswers });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- Parent state setters are stable and did not replay remote updates.
    }, [collaboration.remoteUpdates]);

    return collaboration;
}
