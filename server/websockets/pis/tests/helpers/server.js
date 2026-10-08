const { createCollaborationServer } = require('../../src/app');
const { once } = require('node:events');
const { io: connect } = require('socket.io-client');

// Start an isolated collaboration server and register cleanup for its clients and timers.
async function startServer(t) {
    const timeouts = [];
    const intervals = [];
    const timers = {
        // Track a timeout so fixture cleanup can cancel it.
        setTimeout: (...args) => {
            const timer = setTimeout(...args);
            timeouts.push(timer);
            return timer;
        },
        // Track an interval so fixture cleanup can cancel it.
        setInterval: (...args) => {
            const timer = setInterval(...args);
            intervals.push(timer);
            return timer;
        },
    };

    const { server, io } = createCollaborationServer({ timers });
    const clients = [];
    t.after(async () => {
        // Disconnect fixture clients, close the server, and cancel remaining timers.
        for (const client of clients) client.disconnect();
        await new Promise(/* Resolve when Socket.IO finishes closing. */ (resolve) => io.close(resolve));
        for (const timer of timeouts) clearTimeout(timer);
        for (const timer of intervals) clearInterval(timer);
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}`;

    return {
        url,
        // Connect a fixture client and wait for its initial room snapshot and membership list.
        async client(userId = 'brother-1', roomId = 'pis-1') {
            const client = connect(url, { transports: ['websocket'], forceNew: true, reconnection: false });
            clients.push(client);
            await event(client, 'connect');
            const state = event(client, 'document-state');
            const members = event(client, 'users-updated');
            client.emit('join-room', { roomId, userId, userName: userId });
            await Promise.all([state, members]);
            return client;
        },
    };
}

// Wait for one socket event, rejecting if it does not arrive within three seconds.
function event(client, name) {
    return new Promise((resolve, reject) => {
        // Attach a one-shot event listener and its timeout.
        const timer = setTimeout(() => {
            // Remove the pending listener and reject the expired event wait.
            client.off(name, receive);
            reject(new Error(`Timed out waiting for ${name}`));
        }, 3000);
        // Cancel the timeout and resolve with the received event payload.
        function receive(payload) {
            clearTimeout(timer);
            resolve(payload);
        }
        client.once(name, receive);
    });
}

// Request and return a fresh document snapshot from the server.
async function documentState(client) {
    const response = event(client, 'document-state');
    client.emit('request-document-state');
    return response;
}

module.exports = { startServer, event, documentState };
