export function applyDocumentState(docState, { setBrotherA, setBrotherB, setAnswers }) {
    if (docState && Object.keys(docState).length > 0) {
        // A new session may start with empty WebSocket fields; keep names loaded from the database.
        if (docState['_brotherA_firstName'] !== undefined && docState['_brotherA_firstName']) {
            setBrotherA(prev => prev.firstName !== docState['_brotherA_firstName']
                ? { ...prev, firstName: docState['_brotherA_firstName'] } : prev);
        }
        if (docState['_brotherA_lastName'] !== undefined && docState['_brotherA_lastName']) {
            setBrotherA(prev => prev.lastName !== docState['_brotherA_lastName']
                ? { ...prev, lastName: docState['_brotherA_lastName'] } : prev);
        }
        if (docState['_brotherB_firstName'] !== undefined && docState['_brotherB_firstName']) {
            setBrotherB(prev => prev.firstName !== docState['_brotherB_firstName']
                ? { ...prev, firstName: docState['_brotherB_firstName'] } : prev);
        }
        if (docState['_brotherB_lastName'] !== undefined && docState['_brotherB_lastName']) {
            setBrotherB(prev => prev.lastName !== docState['_brotherB_lastName']
                ? { ...prev, lastName: docState['_brotherB_lastName'] } : prev);
        }

        setAnswers(prev => {
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

export function applyRemoteUpdates(updates, { setBrotherA, setBrotherB, setAnswers }) {
    if (updates && updates.length > 0) {
        // Live edits can intentionally clear a name, unlike an initial document snapshot.
        const latestUpdate = updates[updates.length - 1];
        const { field, value } = latestUpdate;

        if (field === '_brotherA_firstName') {
            setBrotherA(prev => prev.firstName !== value ? { ...prev, firstName: value || '' } : prev);
        } else if (field === '_brotherA_lastName') {
            setBrotherA(prev => prev.lastName !== value ? { ...prev, lastName: value || '' } : prev);
        } else if (field === '_brotherB_firstName') {
            setBrotherB(prev => prev.firstName !== value ? { ...prev, firstName: value || '' } : prev);
        } else if (field === '_brotherB_lastName') {
            setBrotherB(prev => prev.lastName !== value ? { ...prev, lastName: value || '' } : prev);
        } else {
            setAnswers(prev => {
                if (prev[field] !== value) {
                    return { ...prev, [field]: value };
                }
                return prev;
            });
        }
    }
}
