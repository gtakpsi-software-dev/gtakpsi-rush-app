const transformOperation = (op1, op2) => {
    // Simple operational transformation logic
    // This handles the case where two operations happen simultaneously
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

module.exports = { transformOperation };
