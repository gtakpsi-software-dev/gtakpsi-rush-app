// Register health and room-statistics HTTP endpoints.
function registerRoutes(app, rooms) {
    app.get('/health', (req, res) => {
        // Return room and connection counts with the current health timestamp.
        const roomCount = rooms.size;
        const totalConnections = Array.from(rooms.values()).reduce(/* Add this room's user count to the connection total. */ (sum, room) => sum + room.users.size, 0);

        res.json({
            status: 'healthy',
            rooms: roomCount,
            connections: totalConnections,
            timestamp: new Date().toISOString()
        });
    });

    app.get('/rooms/:roomId/stats', (req, res) => {
        // Return room presence and activity statistics, or a not-found response.
        const { roomId } = req.params;
        const room = rooms.get(roomId);

        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        res.json({
            roomId,
            userCount: room.users.size,
            users: Array.from(room.users.values()).map(/* Expose user identity and connection time without the socket ID. */ user => ({
                id: user.id,
                name: user.name,
                connectedAt: user.connectedAt
            })),
            operationCount: room.operations.length,
            lastActivity: room.lastActivity
        });
    });
}

module.exports = { registerRoutes };
