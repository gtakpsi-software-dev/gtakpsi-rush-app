// Apply an edit only at the current field version, otherwise return the server value and version.
function applyVersionedTextUpdate(room, { field, value, baseVersion }) {
    const currentVersion = room.versions.get(field) || 0;

    // INVARIANT: stale writes leave both the document and activity time unchanged.
    if (baseVersion !== currentVersion) {
        return {
            accepted: false,
            serverValue: room.document.get(field) || '',
            serverVersion: currentVersion,
        };
    }

    const version = currentVersion + 1;
    room.document.set(field, value);
    room.versions.set(field, version);
    room.lastActivity = new Date().toISOString();

    return { accepted: true, version };
}

module.exports = { applyVersionedTextUpdate };
