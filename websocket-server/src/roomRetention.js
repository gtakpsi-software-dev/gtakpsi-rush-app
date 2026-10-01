// Empty rooms stay available for short reconnects; the sweep clears rooms
// that remain idle after their editors leave.
const EMPTY_ROOM_GRACE_MS = 5 * 60 * 1000;
const IDLE_ROOM_LIMIT_MS = 60 * 60 * 1000;
const ROOM_SWEEP_INTERVAL_MS = 10 * 60 * 1000;

module.exports = { EMPTY_ROOM_GRACE_MS, IDLE_ROOM_LIMIT_MS, ROOM_SWEEP_INTERVAL_MS };
