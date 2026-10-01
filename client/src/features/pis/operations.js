export const applyOperation = (text, operation) => {
    const { type, position, content, length } = operation;

    switch (type) {
        case 'insert':
            return text.slice(0, position) + (content || '') + text.slice(position);
        case 'delete':
            return text.slice(0, position) + text.slice(position + (length || 0));
        case 'replace':
            return text.slice(0, position) + (content || '') + text.slice(position + (length || 0));
        default:
            return text;
    }
};

export const createOperation = (type, position, content = '', length = 0, field = '') => ({
    type,
    position,
    content,
    length,
    field,
    timestamp: Date.now(),
    id: Math.random().toString(36).substr(2, 9),
});

export const createOperationsFromDiff = (oldText, newText, field) => {
    const operations = [];

    let prefixLength = 0;
    while (
        prefixLength < oldText.length &&
        prefixLength < newText.length &&
        oldText[prefixLength] === newText[prefixLength]
    ) {
        prefixLength++;
    }

    let suffixLength = 0;
    while (
        suffixLength < (oldText.length - prefixLength) &&
        suffixLength < (newText.length - prefixLength) &&
        oldText[oldText.length - 1 - suffixLength] === newText[newText.length - 1 - suffixLength]
    ) {
        suffixLength++;
    }

    const oldMiddle = oldText.slice(prefixLength, oldText.length - suffixLength);
    const newMiddle = newText.slice(prefixLength, newText.length - suffixLength);

    if (oldMiddle.length > 0) {
        operations.push(createOperation('delete', prefixLength, '', oldMiddle.length, field));
    }

    if (newMiddle.length > 0) {
        operations.push(createOperation('insert', prefixLength, newMiddle, 0, field));
    }

    return operations;
};
