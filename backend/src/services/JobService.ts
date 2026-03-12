import * as path from 'path';
import * as fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import { Job, ConversionOptions, JobOutput } from '../types';
import { ConversionService } from './ConversionService';

export class JobService {
  private static instance: JobService;
  private jobs: Map<string, Job> = new Map();
  private readonly uploadDir: string;
  private readonly outputDir: string;
  private readonly jobTimeoutMs: number = 30 * 60 * 1000; // 30 minutes
  private conversionService: ConversionService;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    this.outputDir = process.env.OUTPUT_DIR || path.join(process.cwd(), 'outputs');
    this.conversionService = new ConversionService();
    
    // Ensure directories exist
    fs.ensureDirSync(this.uploadDir);
    fs.ensureDirSync(this.outputDir);
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  static getInstance(): JobService {
    if (!JobService.instance) {
      JobService.instance = new JobService();
    }
    return JobService.instance;
  }

  async initialize(): Promise<void> {
    // Start initialization in background without waiting
    this.conversionService.initialize();
  }

  createJob(files: string[], options: ConversionOptions, coverFile?: string): Job {
    const id = uuidv4();
    const now = new Date();
    
    const job: Job = {
      id,
      status: 'pending',
      progress: 0,
      message: 'Waiting to start...',
      options,
      files,
      coverFile,
      outputs: [],
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + this.jobTimeoutMs),
    };

    this.jobs.set(id, job);
    return job;
  }

  async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status !== 'pending') {
      throw new Error('Job is already being processed or completed');
    }

    job.status = 'processing';
    job.message = 'Starting conversion...';
    job.updatedAt = new Date();

    const outputDir = path.join(this.outputDir, jobId);

    try {
      await fs.ensureDir(outputDir);

      const result = await this.conversionService.convert(
        job.files,
        job.options,
        outputDir,
        (message, progress) => {
          job.message = message;
          job.progress = progress;
          job.updatedAt = new Date();
        }
      );

      // Get file sizes and create output records
      for (const output of result.outputs) {
        const stats = await fs.stat(output.path);
        job.outputs.push({
          filename: output.filename,
          path: output.path,
          size: stats.size,
          type: output.type as 'paperback' | 'hardcover' | 'epub',
        });
      }

      job.status = 'completed';
      job.progress = 100;
      job.message = 'Conversion complete';
      job.updatedAt = new Date();
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.message = 'Conversion failed';
      job.updatedAt = new Date();
      
      // Clean up output directory on failure
      await fs.remove(outputDir).catch(() => {});
    }
  }

  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  getJobStatus(id: string): { status: string; progress: number; message: string; error?: string } | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;

    return {
      status: job.status,
      progress: job.progress,
      message: job.message,
      error: job.error,
    };
  }

  getJobOutputs(id: string): JobOutput[] | undefined {
    const job = this.jobs.get(id);
    if (!job || job.status !== 'completed') return undefined;
    return job.outputs;
  }

  async cleanupJob(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;

    // Remove uploaded files
    for (const file of job.files) {
      await fs.remove(file).catch(() => {});
    }
    if (job.coverFile) {
      await fs.remove(job.coverFile).catch(() => {});
    }

    // Remove output directory
    const outputDir = path.join(this.outputDir, id);
    await fs.remove(outputDir).catch(() => {});

    this.jobs.delete(id);
  }

  private startCleanupInterval(): void {
    // Clean up expired jobs every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredJobs();
    }, 5 * 60 * 1000);
  }

  private async cleanupExpiredJobs(): Promise<void> {
    const now = new Date();
    const expiredJobs: string[] = [];

    for (const [id, job] of this.jobs) {
      if (now > job.expiresAt) {
        expiredJobs.push(id);
      }
    }

    for (const id of expiredJobs) {
      await this.cleanupJob(id);
    }

    if (expiredJobs.length > 0) {
      console.log(`Cleaned up ${expiredJobs.length} expired jobs`);
    }
  }

  getUploadDir(): string {
    return this.uploadDir;
  }

  getOutputDir(): string {
    return this.outputDir;
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
