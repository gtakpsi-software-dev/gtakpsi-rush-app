import { useEffect } from 'react';

import { useCollaboration } from './useCollaboration';
import { applyDocumentState, applyRemoteUpdates } from './collaborationState';

export function usePisCollaborationState({
    gtid,
    currentUser,
    setBrotherA,
    setBrotherB,
    setAnswers,
}) {
    const collaboration = useCollaboration(`pis-${gtid}`, currentUser);

    useEffect(() => {
        if (collaboration.isConnected) {
            collaboration.requestDocumentState();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- Request only when connection status changes, as in the original page.
    }, [collaboration.isConnected]);

    useEffect(() => {
        applyDocumentState(collaboration.documentState, { setBrotherA, setBrotherB, setAnswers });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- Parent state setters are stable and did not trigger document reapplication.
    }, [collaboration.documentState]);

    useEffect(() => {
        applyRemoteUpdates(collaboration.remoteUpdates, { setBrotherA, setBrotherB, setAnswers });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- Parent state setters are stable and did not replay remote updates.
    }, [collaboration.remoteUpdates]);

    return collaboration;
}
