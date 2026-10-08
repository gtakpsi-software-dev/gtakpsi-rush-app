// Hydrate interview names and answers from a document snapshot without clearing saved names.
export function applyDocumentState(docState, { setBrotherA, setBrotherB, setAnswers }) {
    if (docState && Object.keys(docState).length > 0) {
        // A new session may start with empty WebSocket fields; keep names loaded from the database.
        if (docState['_brotherA_firstName'] !== undefined && docState['_brotherA_firstName']) {
            setBrotherA(/* Update the first interviewer’s first name when it differs. */ prev => prev.firstName !== docState['_brotherA_firstName']
                ? { ...prev, firstName: docState['_brotherA_firstName'] } : prev);
        }
        if (docState['_brotherA_lastName'] !== undefined && docState['_brotherA_lastName']) {
            setBrotherA(/* Update the first interviewer’s last name when it differs. */ prev => prev.lastName !== docState['_brotherA_lastName']
                ? { ...prev, lastName: docState['_brotherA_lastName'] } : prev);
        }
        if (docState['_brotherB_firstName'] !== undefined && docState['_brotherB_firstName']) {
            setBrotherB(/* Update the second interviewer’s first name when it differs. */ prev => prev.firstName !== docState['_brotherB_firstName']
                ? { ...prev, firstName: docState['_brotherB_firstName'] } : prev);
        }
        if (docState['_brotherB_lastName'] !== undefined && docState['_brotherB_lastName']) {
            setBrotherB(/* Update the second interviewer’s last name when it differs. */ prev => prev.lastName !== docState['_brotherB_lastName']
                ? { ...prev, lastName: docState['_brotherB_lastName'] } : prev);
        }

        setAnswers(prev => {
            // Merge changed answer fields while retaining state identity when nothing changes.
            let changed = false;
            const merged = { ...prev };
            for (const [field, value] of Object.entries(docState)) {
                if (field.startsWith('_brother')) continue;
                if (merged[field] !== value) {
                    merged[field] = value;
                    changed = true;
                }
            }
            return changed ? merged : prev;
        });
    }
}

// Apply the latest live update to its interviewer-name or answer field.
export function applyRemoteUpdates(updates, { setBrotherA, setBrotherB, setAnswers }) {
    if (updates && updates.length > 0) {
        // Live edits can intentionally clear a name, unlike an initial document snapshot.
        const latestUpdate = updates[updates.length - 1];
        const { field, value } = latestUpdate;

        if (field === '_brotherA_firstName') {
            setBrotherA(
                /* Update or clear the first interviewer’s first name. */
                prev => prev.firstName !== value ? { ...prev, firstName: value || '' } : prev);
        } else if (field === '_brotherA_lastName') {
            setBrotherA(
                /* Update or clear the first interviewer’s last name. */
                prev => prev.lastName !== value ? { ...prev, lastName: value || '' } : prev);
        } else if (field === '_brotherB_firstName') {
            setBrotherB(
                /* Update or clear the second interviewer’s first name. */
                prev => prev.firstName !== value ? { ...prev, firstName: value || '' } : prev);
        } else if (field === '_brotherB_lastName') {
            setBrotherB(
                /* Update or clear the second interviewer’s last name. */
                prev => prev.lastName !== value ? { ...prev, lastName: value || '' } : prev);
        } else {
            setAnswers(prev => {
                // Update the answer only when the received value differs.
                if (prev[field] !== value) {
                    return { ...prev, [field]: value };
                }
                return prev;
            });
        }
    }
}
