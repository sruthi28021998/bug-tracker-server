const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { getAccess } = require('./middleware/access');

let io;

exports.init = (server) => {
  io = new Server(server, { cors: { origin: process.env.CLIENT_URL || '*' } });

  io.use((socket, next) => {
    try {
      socket.user = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('joinProject', async (projectId) => {
      try {
        if (await getAccess(projectId, socket.user.id)) socket.join(`project:${projectId}`);
      } catch {}
    });
    socket.on('leaveProject', (projectId) => socket.leave(`project:${projectId}`));
  });
};

exports.emit = (projectId, event, payload = {}) => {
  if (io) io.to(`project:${projectId}`).emit(event, { ...payload, projectId: String(projectId) });
};