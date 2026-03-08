import { createServer } from './server';
import { JobService } from './services/JobService';

const PORT = process.env.PORT || 3000;

async function main() {
  try {
    console.log('Starting tobook server...');
    
    // Initialize services
    const jobService = JobService.getInstance();
    console.log('Initializing services...');
    await jobService.initialize();
    console.log('Services initialized');

    // Create and start server
    const app = await createServer();
    
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
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
