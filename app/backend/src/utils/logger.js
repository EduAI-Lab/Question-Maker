/**
 * Centralized Pino logger configuration shared across the backend.
 * Handles redaction, pretty-printing in development, and JSON output in production.
 */
import pino from 'pino';

/**
 * Pino logger configuration
 * 
 * Pino is a production-grade logger with:
 * - Async logging (non-blocking)
 * - Minimal JSON output
 * - Very low CPU overhead
 * - Designed for containers
 * 
 * Log levels (in order of severity):
 * - error: Always logged
 * - warn: Always logged
 * - info: Minimal logging (default in production)
 * - debug: Disabled in production
 * - trace: Disabled in production
 */

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const isProduction = process.env.NODE_ENV === 'production';

// Base configuration
const pinoConfig = {
  level: LOG_LEVEL.toLowerCase(),
  
  // Redact sensitive information
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'token',
      'secret',
      'apiKey',
    ],
    remove: true,
  },
};

// In production, use JSON format (structured logging)
if (isProduction) {
  pinoConfig.formatters = {
    level: (label) => {
      return { level: label };
    },
  };
  pinoConfig.timestamp = pino.stdTimeFunctions.isoTime;
} else {
  // Development: Use pretty printing for readability
  // pino-pretty is a devDependency, so it should be available in development
  pinoConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  };
}

// Create the logger instance
// If pino-pretty is not available (e.g., in Docker without devDependencies),
// Pino will fall back to default JSON output
export const logger = pino(pinoConfig);

export default logger;
