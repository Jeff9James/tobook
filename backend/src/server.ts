import express from 'express';
import cors from 'cors';
import * as path from 'path';
import { createUploadRoutes } from './routes/upload';
import { createConvertRoutes } from './routes/convert';
import { createStatusRoutes } from './routes/status';
import { createDownloadRoutes } from './routes/download';
import { JobService } from './services/JobService';

export async function createServer(): Promise<express.Application> {
  const app = express();
  const jobService = JobService.getInstance();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    const status = jobService['conversionService'].getStatus();
    res.json({
      status: status.ready ? 'ok' : 'starting',
      binaries: status,
      ready: status.ready,
    });
  });

  // Routes
  app.use('/api', createUploadRoutes(jobService));
  app.use('/api', createConvertRoutes(jobService));
  app.use('/api', createStatusRoutes(jobService));
  app.use('/api', createDownloadRoutes(jobService));

  // Error handler
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
