import { Router } from 'express';
import * as path from 'path';
import * as fs from 'fs-extra';
import { JobService } from '../services/JobService';

export function createDownloadRoutes(jobService: JobService): Router {
  const router = Router();

  // Download specific file
  router.get('/download/:jobId/:filename', async (req, res) => {
    try {
      const { jobId, filename } = req.params;
      const job = jobService.getJob(jobId);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.status !== 'completed') {
        return res.status(400).json({ error: 'Job not completed yet' });
      }

      const output = job.outputs.find(o => o.filename === filename);
      if (!output) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Check file exists
      if (!await fs.pathExists(output.path)) {
        return res.status(404).json({ error: 'File no longer available' });
      }

      // Set appropriate content type
      const ext = path.extname(filename).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.pdf') contentType = 'application/pdf';
      if (ext === '.epub') contentType = 'application/epub+zip';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      const stream = fs.createReadStream(output.path);
      stream.pipe(res);
    } catch (error) {
      console.error('Download error:', error);
      res.status(500).json({
        error: 'Download failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Download all files as zip
  router.get('/download/:jobId/all', async (req, res) => {
    try {
      const { jobId } = req.params;
      const job = jobService.getJob(jobId);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.status !== 'completed') {
        return res.status(400).json({ error: 'Job not completed yet' });
      }

      if (job.outputs.length === 0) {
        return res.status(404).json({ error: 'No files available' });
      }

      // Create zip archive
      const archiver = await import('archiver');
      const archive = archiver.default('zip', { zlib: { level: 9 } });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${jobId}.zip"`);

      archive.on('error', (err) => {
        throw err;
      });

      archive.pipe(res);

      for (const output of job.outputs) {
        if (await fs.pathExists(output.path)) {
          archive.file(output.path, { name: output.filename });
        }
      }

      await archive.finalize();
    } catch (error) {
      console.error('Download all error:', error);
      res.status(500).json({
        error: 'Download failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
