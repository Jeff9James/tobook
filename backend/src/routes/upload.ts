import { Router } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs-extra';
import { JobService } from '../services/JobService';

export function createUploadRoutes(jobService: JobService): Router {
  const router = Router();
  const uploadDir = jobService.getUploadDir();

  // Configure multer storage
  const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
      const sessionDir = path.join(uploadDir, `session-${Date.now()}`);
      await fs.ensureDir(sessionDir);
      cb(null, sessionDir);
    },
    filename: (req, file, cb) => {
      // Sanitize filename
      const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      cb(null, `${Date.now()}-${sanitized}`);
    },
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB per file
      files: 20, // Max 20 files
    },
    fileFilter: (req, file, cb) => {
      if (file.fieldname === 'markdown') {
        // Accept markdown files
        if (file.mimetype === 'text/markdown' || 
            file.mimetype === 'text/plain' ||
            file.originalname.endsWith('.md')) {
          cb(null, true);
        } else {
          cb(new Error('Only markdown files are allowed for markdown field'));
        }
      } else if (file.fieldname === 'cover') {
        // Accept image files
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed for cover'));
        }
      } else {
        cb(new Error('Unexpected field name'));
      }
    },
  });

  // Upload endpoint
  router.post(
    '/upload',
    upload.fields([
      { name: 'markdown', maxCount: 20 },
      { name: 'cover', maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        
        if (!files || !files.markdown || files.markdown.length === 0) {
          return res.status(400).json({ error: 'No markdown files uploaded' });
        }

        const markdownFiles = files.markdown.map(f => f.path);
        const coverFile = files.cover?.[0]?.path;

        res.json({
          files: markdownFiles,
          coverFile,
          count: markdownFiles.length,
        });
      } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
          error: 'Upload failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Handle multer errors
  router.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large (max 50MB)' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Too many files (max 20)' });
      }
      return res.status(400).json({ error: err.message });
    }
    next(err);
  });

  return router;
}
