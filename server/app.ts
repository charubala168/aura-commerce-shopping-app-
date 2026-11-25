import express from 'express';
import { coreRouter } from './routes/coreRoutes.ts';
import { commerceRouter } from './routes/commerceRoutes.ts';
import { adminAndSupportRouter } from './routes/adminAndSupportRoutes.ts';

export function createApiApp() {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.use('/api', coreRouter);
  app.use('/api', commerceRouter);
  app.use('/api', adminAndSupportRouter);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'aura-commerce',
      realtime: !process.env.VERCEL,
    });
  });

  return app;
}
