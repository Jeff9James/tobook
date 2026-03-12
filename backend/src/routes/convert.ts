import { Router } from 'express';
import { JobService } from '../services/JobService';
import { ConversionOptions } from '../types';
import { VALID_FORMATS, VALID_FONT_SIZES } from '../config/trimSizes';
import { TRIM_SIZES } from '../config/trimSizes';

export function createConvertRoutes(jobService: JobService): Router {
  const router = Router();

  router.post('/convert', async (req, res) => {
    try {
      const {
        files,
        coverFile,
        title,
        author,
        subtitle,
        format = 'all',
        trim = '5x8',
        toc = false,
        fontSize = '11pt',
        openRight = false,
        year = new Date().getFullYear().toString(),
        isbn,
      } = req.body;

      // Check if binaries are ready
      const status = (jobService as any)['conversionService'].getStatus();
      if (!status.ready) {
        return res.status(503).json({
          error: 'Service unavailable',
          message: 'Binaries are still installing. Please try again in a few minutes.',
          installing: status.installing,
        });
      }

      // Validate required fields
      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      // Validate format
      if (!VALID_FORMATS.includes(format)) {
        return res.status(400).json({ 
          error: `Invalid format. Must be one of: ${VALID_FORMATS.join(', ')}` 
        });
      }

      // Validate trim size
      if (!TRIM_SIZES[trim]) {
        return res.status(400).json({ 
          error: `Invalid trim size. Must be one of: ${Object.keys(TRIM_SIZES).join(', ')}` 
        });
      }

      // Validate font size
      if (!VALID_FONT_SIZES.includes(fontSize)) {
        return res.status(400).json({ 
          error: `Invalid font size. Must be one of: ${VALID_FONT_SIZES.join(', ')}` 
        });
      }

      const options: ConversionOptions = {
        title,
        author,
        subtitle,
        format: format as 'pdf' | 'epub' | 'all',
        trim,
        toc,
        fontSize,
        openRight,
        year,
        isbn,
      };

      // Create job
      const job = jobService.createJob(files, options, coverFile);

      // Start processing in background
      jobService.processJob(job.id).catch(err => {
        console.error(`Job ${job.id} failed:`, err);
      });

      res.json({
        jobId: job.id,
        status: job.status,
        message: job.message,
      });
    } catch (error) {
      console.error('Convert error:', error);
      res.status(500).json({
        error: 'Conversion request failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get conversion options/config
  router.get('/config', (req, res) => {
    res.json({
      formats: VALID_FORMATS,
      trimSizes: Object.keys(TRIM_SIZES),
      fontSizes: VALID_FONT_SIZES,
      trimDetails: TRIM_SIZES,
    });
  });

  return router;
}
