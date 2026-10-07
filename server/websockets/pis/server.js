const { createCollaborationServer } = require('./src/app');

const { server } = createCollaborationServer();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 WebSocket server running on port ${PORT}`);
    console.log(`📊 Health check available at http://localhost:${PORT}/health`);
});

function shutdownServer(signal) {
    console.log(`${signal} received, closing server...`);
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
}

process.on('SIGTERM', () => shutdownServer('SIGTERM'));
process.on('SIGINT', () => shutdownServer('SIGINT'));
