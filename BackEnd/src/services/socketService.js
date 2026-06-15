const { Server } = require('socket.io');
const { verifyToken } = require('../config/jwt');
const { getDB } = require('../config/database');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('No token provided'));

      const decoded = verifyToken(token);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join_device_log', async (deviceId) => {
      if (!deviceId || typeof deviceId !== 'string') return;

      try {
        const db = getDB();
        let query = 'SELECT id, client_id FROM fingerprint_devices WHERE device_id = ?';
        const params = [deviceId];

        if (!socket.user.isSuperAdmin) {
          query += ' AND client_id = ?';
          params.push(socket.user.clientId);
        }

        const [rows] = await db.execute(query, params);
        if (rows.length === 0) return; // not authorized for this device

        socket.join(`device:${deviceId}`);
      } catch (err) {
        console.error('join_device_log error:', err.message);
      }
    });

    socket.on('leave_device_log', (deviceId) => {
      if (!deviceId || typeof deviceId !== 'string') return;
      socket.leave(`device:${deviceId}`);
    });
  });

  return io;
}

function emitDeviceLog(deviceId, line) {
  if (!io) return;
  io.to(`device:${deviceId}`).emit('device_log', { deviceId, line, ts: Date.now() });
}

function emitDeviceEvent(deviceId, event, data) {
  if (!io) return;
  io.to(`device:${deviceId}`).emit('device_event', { deviceId, event, data, ts: Date.now() });
}

module.exports = {
  initSocket,
  emitDeviceLog,
  emitDeviceEvent,
};
