const { createCollaborationServer } = require('../../src/app');
const { once } = require('node:events');
const { io: connect } = require('socket.io-client');

async function startServer(t) {
    const timeouts = [];
    const intervals = [];
    const timers = {
        setTimeout: (...args) => {
            const timer = setTimeout(...args);
            timeouts.push(timer);
            return timer;
        },
        setInterval: (...args) => {
            const timer = setInterval(...args);
            intervals.push(timer);
            return timer;
        },
    };

    const { server, io } = createCollaborationServer({ timers });
    const clients = [];
    t.after(async () => {
        for (const client of clients) client.disconnect();
        await new Promise((resolve) => io.close(resolve));
        for (const timer of timeouts) clearTimeout(timer);
        for (const timer of intervals) clearInterval(timer);
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}`;

    return {
        url,
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

function event(client, name) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            client.off(name, receive);
            reject(new Error(`Timed out waiting for ${name}`));
        }, 3000);
        function receive(payload) {
            clearTimeout(timer);
            resolve(payload);
        }
        client.once(name, receive);
    });
}

async function documentState(client) {
    const response = event(client, 'document-state');
    client.emit('request-document-state');
    return response;
}

module.exports = { startServer, event, documentState };
