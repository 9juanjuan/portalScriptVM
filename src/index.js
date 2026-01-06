const PortalMonitor = require('./PortalMonitor');
const logger = require('./logger');

// Handle process termination
process.on('SIGINT', async () => {
  logger.info('Received SIGINT. Shutting down...');
  await monitor.stopMonitoring();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM. Shutting down...');
  await monitor.stopMonitoring();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  // Don't exit immediately, try to clean up
  monitor.stopMonitoring().finally(() => {
    process.exit(1);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason: reason?.message || reason, promise });
});

// Create and start the monitor
const monitor = new PortalMonitor();

// Start monitoring
monitor.startMonitoring().catch(error => {
  logger.error('Failed to start monitoring', { error: error.message });
  process.exit(1);
});

// Log monitoring status periodically
setInterval(() => {
  logger.info('Portal monitor is running...');
}, 3600000); // Log every hour
