import { createServer } from './server';
import { JobService } from './services/JobService';

const PORT = process.env.PORT || 3000;

async function main() {
  try {
    console.log('Starting tobook server...');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('PORT:', process.env.PORT);

    // Initialize services (non-blocking)
    const jobService = JobService.getInstance();
    console.log('JobService created');

    // Don't await - run in background
    jobService.initialize().catch(err => {
      console.error('Background initialization error:', err);
    });
    console.log('Background initialization started');

    // Create and start server
    const app = await createServer();
    console.log('Express app created');

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });

    // Error handling
    server.on('error', (err) => {
      console.error('Server error:', err);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\nShutting down gracefully...');

      server.close(() => {
        console.log('HTTP server closed');
      });

      jobService.stop();

      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
