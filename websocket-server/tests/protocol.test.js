const assert = require('node:assert/strict');
const test = require('node:test');
const { startServer, event, documentState } = require('./helpers/server');

async function update(client, payload) {
    const response = event(client, 'text-ack');
    client.emit('text-update', payload);
    return response;
}

async function waitForRoomUserCount(url, expected) {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
        const response = await fetch(`${url}/rooms/pis-1/stats`);
        if (response.ok) {
            const stats = await response.json();
            if (stats.users.length === expected) return stats;
        }
        // Client disconnect returns before the server processes its membership update.
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timed out waiting for ${expected} users in pis-1`);
}

const initialUpdate = {
    field: 'notes', value: 'First observation', baseVersion: 0,
    clientUpdateId: 'update-1', userId: 'claimed-user', userName: 'Claimed Name',
};

test('health, missing rooms, room membership, and disconnect preserve response shapes', async (t) => {
    const service = await startServer(t);
    const missing = await fetch(`${service.url}/rooms/missing/stats`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'Room not found' });

    const first = await service.client();
    const joined = event(first, 'users-updated');
    const second = await service.client('brother-2');
    assert.deepEqual((await joined).map((user) => user.id), ['brother-1', 'brother-2']);
    const health = await (await fetch(`${service.url}/health`)).json();
    assert.deepEqual(Object.keys(health).sort(), ['connections', 'rooms', 'status', 'timestamp']);
    assert.equal(health.status, 'healthy');
    assert.equal(health.rooms, 1);
    assert.equal(health.connections, 2);
    assert.ok(Number.isFinite(Date.parse(health.timestamp)));

    const stats = await (await fetch(`${service.url}/rooms/pis-1/stats`)).json();
    assert.equal(stats.roomId, 'pis-1');
    assert.equal(stats.operationCount, 0);
    assert.deepEqual(stats.users.map(({ id, name }) => ({ id, name })), [
        { id: 'brother-1', name: 'brother-1' }, { id: 'brother-2', name: 'brother-2' },
    ]);
    assert.ok(stats.users.every((user) => !('socketId' in user)));

    const left = event(first, 'users-updated');
    second.disconnect();
    assert.deepEqual((await left).map((user) => user.id), ['brother-1']);
});

test('full-text updates acknowledge the sender, broadcast committed versions, and hydrate late joiners', async (t) => {
    const service = await startServer(t);
    const first = await service.client();
    const second = await service.client('brother-2');
    const broadcast = event(second, 'text-update');
    const ack = await update(first, initialUpdate);
    assert.deepEqual({ ...ack, timestamp: 0 }, {
        field: 'notes', version: 1, clientUpdateId: 'update-1', timestamp: 0,
    });
    assert.deepEqual({ ...await broadcast, timestamp: 0 }, {
        field: 'notes', value: 'First observation', version: 1,
        userId: 'claimed-user', userName: 'Claimed Name', timestamp: 0,
    });
    assert.deepEqual(await documentState(await service.client('late-joiner')), {
        notes: { value: 'First observation', version: 1 },
    });
    assert.deepEqual(await documentState(await service.client('other', 'pis-2')), {});
});

test('an empty room retains document versions while its editor reconnects', async (t) => {
    const service = await startServer(t);
    const first = await service.client();
    await update(first, initialUpdate);

    first.disconnect();
    const emptyRoom = await waitForRoomUserCount(service.url, 0);
    assert.equal(emptyRoom.roomId, 'pis-1');

    const reconnected = await service.client();
    assert.deepEqual(await documentState(reconnected), {
        notes: { value: 'First observation', version: 1 },
    });
    const ack = await update(reconnected, {
        ...initialUpdate, value: 'After reconnect', baseVersion: 1, clientUpdateId: 'update-2',
    });
    assert.equal(ack.version, 2);
    assert.deepEqual(await documentState(reconnected), {
        notes: { value: 'After reconnect', version: 2 },
    });
});

test('stale versions reject with server truth and do not mutate the document', async (t) => {
    const service = await startServer(t);
    const client = await service.client();
    await update(client, initialUpdate);
    const rejection = event(client, 'text-reject');
    client.emit('text-update', { ...initialUpdate, value: 'Stale', clientUpdateId: 'stale' });
    assert.deepEqual({ ...await rejection, timestamp: 0 }, {
        field: 'notes', serverValue: 'First observation', serverVersion: 1,
        clientUpdateId: 'stale', timestamp: 0,
    });
    assert.deepEqual(await documentState(client), { notes: { value: 'First observation', version: 1 } });
});

test('malformed updates are ignored; non-string values become empty strings and versions are per field', async (t) => {
    const service = await startServer(t);
    const client = await service.client();
    for (const payload of [null, {}, { ...initialUpdate, baseVersion: '0' }, { ...initialUpdate, clientUpdateId: '' }]) {
        client.emit('text-update', payload);
    }
    assert.deepEqual(await documentState(client), {});
    await update(client, { ...initialUpdate, value: 123 });
    await update(client, { ...initialUpdate, field: 'other' });
    assert.deepEqual(await documentState(client), {
        notes: { value: '', version: 1 }, other: { value: 'First observation', version: 1 },
    });
});

test('presence events use joined identity and remain isolated from other rooms', async (t) => {
    const service = await startServer(t);
    const first = await service.client();
    const second = await service.client('brother-2');
    const outsider = await service.client('outsider', 'pis-2');
    const unexpected = [];
    for (const name of ['cursor-position', 'typing-indicator']) {
        outsider.on(name, (payload) => unexpected.push(payload));
        const received = event(second, name);
        first.emit(name, { field: 'notes', position: 3, userId: 'spoofed', userName: 'spoofed' });
        assert.deepEqual({ ...await received, timestamp: 0 }, {
            field: 'notes', position: 3, userId: 'brother-1', userName: 'brother-1', timestamp: 0,
        });
    }
    await documentState(outsider);
    assert.deepEqual(unexpected, []);
});

test('legacy operations broadcast transformed positions but apply original positions to stored text', async (t) => {
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
    const service = await startServer(t);
    const client = await service.client();
    for (let index = 0; index < 105; index += 1) {
        client.emit('text-operation', { field: 'notes', type: 'insert', position: 0, content: 'x' });
    }
    assert.equal((await documentState(client)).notes.value.length, 105);
    const stats = await (await fetch(`${service.url}/rooms/pis-1/stats`)).json();
    assert.equal(stats.operationCount, 100);
});
