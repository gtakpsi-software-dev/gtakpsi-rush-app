const assert = require('node:assert/strict');
const test = require('node:test');
const { startServer, event, documentState } = require('./helpers/server');

test('legacy operations broadcast transformed positions but apply original positions to stored text', async (t) => {
    // Verify transformed broadcast positions and original-position storage for legacy edits.
    const service = await startServer(t);
    const first = await service.client();
    const second = await service.client('brother-2');
    for (const [operation, position] of [
        [{ type: 'insert', position: 0, content: 'abc' }, 0],
        [{ type: 'insert', position: 0, content: 'X' }, 3],
        [{ type: 'delete', position: 1, length: 1 }, 5],
    ]) {
        const received = event(second, 'text-operation');
        first.emit('text-operation', { ...operation, field: 'notes' });
        const result = await received;
        assert.equal(result.position, position);
        assert.equal(result.userId, 'brother-1');
        assert.match(result.id, /^[0-9a-f-]{36}$/);
    }
    assert.deepEqual(await documentState(first), { notes: { value: 'Xbc', version: 0 } });
});

test('legacy replacements and unknown operation types preserve stored text and version zero', async (t) => {
    // Verify legacy replacement behavior and unchanged version zero.
    const service = await startServer(t);
    const client = await service.client();
    for (const operation of [
        { type: 'replace', position: 0, content: 'abcd' },
        { type: 'replace', position: 1, length: 2, content: 'X' },
        { type: 'delete', position: 1, length: 1 },
        { type: 'unknown', position: 0, content: 'ignored' },
    ]) {
        client.emit('text-operation', { ...operation, field: 'notes' });
    }

    assert.deepEqual(await documentState(client), { notes: { value: 'ad', version: 0 } });
    const stats = await (await fetch(`${service.url}/rooms/pis-1/stats`)).json();
    assert.equal(stats.operationCount, 4);
});

test('legacy history retains only the last 100 operations', async (t) => {
    // Verify that stored operation history is capped at the latest 100 edits.
    const service = await startServer(t);
    const client = await service.client();
    for (let index = 0; index < 105; index += 1) {
        client.emit('text-operation', { field: 'notes', type: 'insert', position: 0, content: 'x' });
    }
    assert.equal((await documentState(client)).notes.value.length, 105);
    const stats = await (await fetch(`${service.url}/rooms/pis-1/stats`)).json();
    assert.equal(stats.operationCount, 100);
});
