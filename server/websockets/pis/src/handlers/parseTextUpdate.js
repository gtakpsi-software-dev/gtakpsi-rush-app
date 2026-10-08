// Normalize a text update and reject payloads missing a field, version, or update ID.
function parseTextUpdate(payload) {
    const field = payload?.field;
    const value = typeof payload?.value === 'string' ? payload.value : '';
    const baseVersion = typeof payload?.baseVersion === 'number' ? payload.baseVersion : undefined;
    const clientUpdateId = typeof payload?.clientUpdateId === 'string' ? payload.clientUpdateId : undefined;

    // INVARIANT: incomplete updates cannot change a room's document or version.
    if (!field || baseVersion === undefined || !clientUpdateId) {
        return null;
    }

    return { field, value, baseVersion, clientUpdateId };
}

module.exports = { parseTextUpdate };
