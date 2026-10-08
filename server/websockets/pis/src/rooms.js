// Create empty user, text, version, and operation state for a collaboration room.
function createRoom() {
    return {
        users: new Map(),
        operations: [],
        // Keep document text and versions separate so legacy operations can retain version zero.
        document: new Map(),
        versions: new Map(),
        lastActivity: new Date().toISOString()
    };
}

// Serialize room text and versions into the document snapshot sent to clients.
function snapshotDocument(room) {
    const documentState = {};
    for (const [field, content] of room.document.entries()) {
        // Legacy operations can change text without a version entry; clients still receive version zero.
        const version = room.versions.get(field) || 0;
        documentState[field] = { value: content, version };
    }
    return documentState;
}

module.exports = { createRoom, snapshotDocument };
