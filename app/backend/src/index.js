/**
 * Application entrypoint: configures Express middleware, routes, logging, and graceful shutdowns.
 * Starts the HTTP server immediately and initializes the database connection in the background.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { errorHandler, notFound } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import questionRoutes from './routes/questions.js';
import courseRoutes from './routes/course.js';
import assessmentRoutes from './routes/assessments.js';
import variantRoutes from './routes/variants.js';
import eduaiRoutes from './routes/eduai.js';
import canvasRoutes from './routes/canvas.js';
import { connectDatabase, sequelize } from './config/database.js';
import { config } from './config/settings.js';
import { logger } from './utils/logger.js';
// Import models to ensure associations are set up
import './schema/index.js';

const app = express();
const PORT = config.port;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}));

// Rate limiting (disabled in development)
if (config.nodeEnv === 'production') {
  const limiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    message: 'Too many requests from this IP, please try again later.'
  });
  app.use(limiter);
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// HTTP request logging with Pino
// Pino-http provides async, non-blocking request logging with minimal overhead
const pinoHttpConfig = {
  logger: logger,
  
  // Custom serializers for request/response
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      remoteAddress: req.remoteAddress,
      remotePort: req.remotePort,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
  
  // In production with warn/error log level, only log errors (4xx, 5xx)
  // In development or with info log level, log all requests
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500) {
      return 'error';
    } else if (res.statusCode >= 400) {
      return 'warn';
    } else if (config.logLevel === 'warn' || config.logLevel === 'error') {
      return 'silent'; // Don't log successful requests in warn/error mode
    }
    return 'info';
  },
  
  // Custom success message
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  
  // Custom error message
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
  },
  
  // Auto-logging on response finish
  autoLogging: {
    ignore: (req) => {
      // Don't log healthcheck endpoints to reduce noise
      return req.url === '/healthz' || req.url === '/';
    },
  },
};

app.use(pinoHttp(pinoHttpConfig));

// Liveness health check endpoint (dumb endpoint - no DB, Redis, Judge0, or heavy processing)
app.get('/healthz', (req, res) => {
  res.status(200).send('ok');
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'EduQuery.ai API is running',
    version: '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/questions', variantRoutes);
app.use('/api/course', courseRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/eduai', eduaiRoutes);
app.use('/api/canvas', canvasRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Store server reference for graceful shutdown
let server = null;

// Graceful shutdown handler
/** Handles SIGTERM/SIGINT by closing the HTTP server and database before exiting. */
const gracefulShutdown = async (signal) => {
  logger.info({ signal }, 'Starting graceful shutdown...');
  
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      
      // Close database connections
      try {
        if (sequelize) {
          await sequelize.close();
          logger.info('Database connections closed');
        }
      } catch (error) {
        logger.error({ err: error }, 'Error closing database');
      }
      
      logger.info('Graceful shutdown complete');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error({ err: error }, 'Uncaught Exception');
  // Don't exit immediately, let the process manager handle it
  // Log the error and continue if possible
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ err: reason, promise }, 'Unhandled Rejection');
  // Don't exit immediately, log and continue
});

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
/** Boots the Express app, wires server error handlers, and kicks off DB connection attempts. */
const startServer = async () => {
  try {
    // Start HTTP server first - don't block on database connection
    // This allows healthcheck to pass even if DB is temporarily unavailable
    server = app.listen(PORT, '0.0.0.0', () => {
      logger.info({
        port: PORT,
        logLevel: config.logLevel,
        nodeEnv: config.nodeEnv,
      }, '🚀 Server running and ready for requests');
    });
    
    // Handle server errors
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }
      
      const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;
      
      switch (error.code) {
        case 'EACCES':
          logger.error({ bind, code: error.code }, 'Port requires elevated privileges');
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error({ bind, code: error.code }, 'Port is already in use');
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

    // Connect to database in background (non-blocking)
    // Allow server to start even if DB connection fails initially
    // The app will retry automatically and handle transient failures
    connectDatabase({ 
      retryOnFailure: true, 
      maxRetries: 10,
      allowFailure: true // Don't crash if DB is unavailable at startup
    }).catch((error) => {
      // Error already logged in connectDatabase, just continue
      logger.warn({ err: error }, 'Server started without database connection. Will retry in background');
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

startServer();

export default app;
