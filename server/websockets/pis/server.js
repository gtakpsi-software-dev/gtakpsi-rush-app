const { createCollaborationServer } = require('./src/app');

const { server } = createCollaborationServer();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    // Log the listening port and health-check URL once the server starts.
    console.log(`🚀 WebSocket server running on port ${PORT}`);
    console.log(`📊 Health check available at http://localhost:${PORT}/health`);
});

// Close the HTTP server in response to a shutdown signal.
function shutdownServer(signal) {
    console.log(`${signal} received, closing server...`);
    server.close(() => {
        // Exit successfully after the server closes.
        console.log('Server closed');
        process.exit(0);
    });
}

process.on('SIGTERM', /* Handle termination by closing the server. */ () => shutdownServer('SIGTERM'));
process.on('SIGINT', /* Handle an interrupt by closing the server. */ () => shutdownServer('SIGINT'));
