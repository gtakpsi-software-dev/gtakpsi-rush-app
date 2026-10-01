export function acceptRemoteTextUpdate(data, userId, knownVersions, resendingFields) {
    if (data.userId === userId) {
        return null;
    }

    const field = data.field;
    // Older servers omit versions; advance from the last known value to retain their update order.
    const incomingVersion = typeof data.version === 'number'
        ? data.version
        : (knownVersions[field] || 0) + 1;

    if ((knownVersions[field] || 0) >= incomingVersion) {
        return null;
    }

    knownVersions[field] = incomingVersion;

    // A local resend owns the displayed value until its acknowledgement arrives.
    if (resendingFields.has(field)) {
        return null;
    }

    return { ...data, version: incomingVersion };
}

export function acknowledgeTextUpdate(ack, knownVersions, pendingUpdates, resendingFields) {
    const { field, version, clientUpdateId } = ack;
    const pending = pendingUpdates[field];

    if (pending && pending.clientUpdateId === clientUpdateId) {
        knownVersions[field] = version;
        delete pendingUpdates[field];
        resendingFields.delete(field);
    }
}

export function rejectTextUpdate(
    rejection,
    currentUser,
    knownVersions,
    pendingUpdates,
    resendingFields,
    createId = () => Math.random().toString(36).substr(2, 9)
) {
    const { field, serverValue, serverVersion, clientUpdateId } = rejection;
    knownVersions[field] = serverVersion;

    const pending = pendingUpdates[field];
    if (pending && pending.clientUpdateId === clientUpdateId) {
        // Reserve the local value while rebasing it on the server's latest version.
        resendingFields.add(field);
        const newId = createId();
        pendingUpdates[field] = { clientUpdateId: newId, value: pending.value };

        return {
            resend: {
                field,
                value: pending.value,
                baseVersion: serverVersion,
                clientUpdateId: newId,
                userId: currentUser.id,
                userName: `${currentUser.firstName} ${currentUser.lastName}`
            }
        };
    }

    return {
        remoteUpdate: { field, value: serverValue, version: serverVersion, userId: 'server' }
    };
}

export function normalizeDocumentState(state) {
    const values = {};
    const versions = {};

    for (const [field, payload] of Object.entries(state || {})) {
        if (payload && typeof payload === 'object' && 'value' in payload) {
            values[field] = payload.value ?? '';
            versions[field] = typeof payload.version === 'number' ? payload.version : 0;
        } else {
            // Older servers send scalar values instead of versioned objects.
            values[field] = payload ?? '';
            versions[field] = 0;
        }
    }

    return { values, versions };
}
