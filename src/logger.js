const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Function to purge old logs (older than 3 hours)
function purgeOldLogs() {
  const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000);
  
  try {
    const files = fs.readdirSync(logDir);
    let purgedCount = 0;
    
    files.forEach(file => {
      const filePath = path.join(logDir, file);
      const stats = fs.statSync(filePath);
      
      // Only purge screenshot files and old log files
      if (stats.mtimeMs < threeHoursAgo && (file.endsWith('.png') || file.endsWith('.log'))) {
        fs.unlinkSync(filePath);
        purgedCount++;
      }
    });
    
    if (purgedCount > 0) {
      console.log(`Purged ${purgedCount} old log file(s)`);
    }
  } catch (error) {
    console.error('Error purging old logs:', error.message);
  }
}

// Run log purge every hour
setInterval(purgeOldLogs, 60 * 60 * 1000);

// Run initial purge on startup
purgeOldLogs();

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'frontline-job-monitor' },
  transports: [
    // Write all logs with level 'error' and below to 'error.log'
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 3
    }),
    // Write all logs to 'combined.log'
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 3
    })
  ]
});

// Always log to console for visibility
logger.add(new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  )
}));

module.exports = logger;
