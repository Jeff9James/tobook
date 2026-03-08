import { Router } from 'express';
import { JobService } from '../services/JobService';

export function createStatusRoutes(jobService: JobService): Router {
  const router = Router();

  // Get job status
  router.get('/status/:id', (req, res) => {
    const { id } = req.params;
    const status = jobService.getJobStatus(id);

    if (!status) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(status);
  });

  // Get job details including outputs (when complete)
  router.get('/jobs/:id', (req, res) => {
    const { id } = req.params;
    const job = jobService.getJob(id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      message: job.message,
      options: job.options,
      outputs: job.outputs.map(o => ({
        filename: o.filename,
        size: o.size,
        type: o.type,
      })),
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      expiresAt: job.expiresAt,
    });
  });

  // Delete/cleanup job
  router.delete('/jobs/:id', async (req, res) => {
    const { id } = req.params;
    const job = jobService.getJob(id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    await jobService.cleanupJob(id);
    res.json({ message: 'Job cleaned up successfully' });
  });

  return router;
}
