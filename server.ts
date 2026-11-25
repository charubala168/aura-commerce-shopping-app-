import http from 'http';
import path from 'path';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './server/app.ts';
import { sanitizeSessionId, verifyAuthToken } from './server/middleware/auth.ts';
import { setSocketServer, startAbandonedCartScheduler } from './server/services/ecommerceService.ts';

async function startServer() {
  const app = createApiApp();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT || 3000);

  // Socket.IO real-time synchronization attached to the same HTTP server on port 3000
  const io = new SocketIOServer(server, {
    cors: {
      origin: true,
      credentials: true,
    },
  });
  setSocketServer(io);
  startAbandonedCartScheduler();

  io.on('connection', (socket) => {
    const authToken = socket.handshake.auth?.token;
    const sessionId = sanitizeSessionId(socket.handshake.auth?.sessionId);

    if (typeof authToken === 'string' && authToken.length > 0) {
      const payload = verifyAuthToken(authToken);
      if (payload) {
        socket.join(`user:${payload.sub}`);
      }
    }
    if (sessionId) {
      socket.join(`anon:${sessionId}`);
    }

    socket.on('sync:identify', (data: { token?: string; sessionId?: string }) => {
      if (typeof data?.token === 'string') {
        const payload = verifyAuthToken(data.token);
        if (payload) socket.join(`user:${payload.sub}`);
      }
      const cleaned = sanitizeSessionId(data?.sessionId);
      if (cleaned) socket.join(`anon:${cleaned}`);
    });
  });

  // Mount Vite middleware in development, or serve static dist in production
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Aura Commerce full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
