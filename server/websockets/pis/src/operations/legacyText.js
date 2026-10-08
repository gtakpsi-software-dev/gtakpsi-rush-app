// Shift an operation's position to account for a preceding insertion or deletion.
const transformOperation = (op1, op2) => {
    // Legacy clients receive shifted positions so near-simultaneous edits do not use stale offsets.
    if (op1.position <= op2.position) {
        if (op1.type === 'insert') {
            return {
                ...op2,
                position: op2.position + (op1.content?.length || 0)
            };
        } else if (op1.type === 'delete') {
            return {
                ...op2,
                position: Math.max(op2.position - (op1.length || 0), op1.position)
            };
        }
    }
    return op2;
};

// Apply a legacy insert, delete, or replace operation to a text value.
function applyOperation(currentDoc, operation) {
    let newDoc = currentDoc;

    switch (operation.type) {
        case 'insert':
            newDoc = currentDoc.slice(0, operation.position) +
                    (operation.content || '') +
                    currentDoc.slice(operation.position);
            break;
        case 'delete':
            newDoc = currentDoc.slice(0, operation.position) +
                    currentDoc.slice(operation.position + (operation.length || 0));
            break;
        case 'replace':
            newDoc = currentDoc.slice(0, operation.position) +
                    (operation.content || '') +
                    currentDoc.slice(operation.position + (operation.length || 0));
            break;
    }

    return newDoc;
}

module.exports = { transformOperation, applyOperation };
