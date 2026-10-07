function registerRoutes(app, rooms) {
    app.get('/health', (req, res) => {
        const roomCount = rooms.size;
        const totalConnections = Array.from(rooms.values()).reduce((sum, room) => sum + room.users.size, 0);

        res.json({
            status: 'healthy',
            rooms: roomCount,
            connections: totalConnections,
            timestamp: new Date().toISOString()
        });
    });

    app.get('/rooms/:roomId/stats', (req, res) => {
        const { roomId } = req.params;
        const room = rooms.get(roomId);

        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        res.json({
            roomId,
            userCount: room.users.size,
            users: Array.from(room.users.values()).map(user => ({
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
