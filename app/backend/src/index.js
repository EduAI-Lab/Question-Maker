import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
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

// Logging
app.use(morgan('combined'));

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
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      
      // Close database connections
      try {
        if (sequelize) {
          await sequelize.close();
          console.log('Database connections closed.');
        }
      } catch (error) {
        console.error('Error closing database:', error);
      }
      
      console.log('Graceful shutdown complete.');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit immediately, let the process manager handle it
  // Log the error and continue if possible
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit immediately, log and continue
});

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📚 EduQuery.ai API ready for requests`);
    });
    
    // Handle server errors
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }
      
      const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;
      
      switch (error.code) {
        case 'EACCES':
          console.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          console.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
