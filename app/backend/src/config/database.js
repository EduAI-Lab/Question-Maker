import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from '../utils/logger.js';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from the project root (4 levels up from app/backend/src/config/database.js)
// app/backend/src/config -> app/backend/src -> app/backend -> app -> root
const projectRoot = join(__dirname, '../../../../');
const envPath = join(projectRoot, '.env');

// Load environment variables
const result = dotenv.config({ path: envPath });

// Check if .env file was loaded and DATABASE_URL exists
if (result.error) {
  logger.warn({ err: result.error, envPath }, 'Could not load .env file');
}

if (!process.env.DATABASE_URL) {
  logger.error({ envPath, projectRoot }, 'DATABASE_URL is not set');
  throw new Error('DATABASE_URL environment variable is required. Please set it in your .env file.');
}

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000, // Maximum time to wait for a connection from the pool
    idle: 10000, // Maximum time a connection can be idle before being released
    evict: 1000, // Check for idle connections every second
    // Handle connection errors in the pool
    handleDisconnects: true,
  },
  // Reconnect on connection loss
  dialectOptions: {
    // PostgreSQL specific options
    connectTimeout: 30000,
  },
  // Sequelize will automatically retry queries on connection errors
  // but we handle reconnection at the application level for better control
});

// Track connection state
let isConnected = false;
let connectionRetryInterval = null;

/**
 * Retry database connection with exponential backoff
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} initialDelay - Initial delay in milliseconds
 * @returns {Promise<void>}
 */
const retryConnection = async (maxRetries = 10, initialDelay = 1000) => {
  let attempt = 0;
  let delay = initialDelay;

  while (attempt < maxRetries) {
    try {
      await sequelize.authenticate();
      isConnected = true;
      logger.info('Database connection successful');
      return;
    } catch (error) {
      attempt++;
      const isLastAttempt = attempt >= maxRetries;
      
      if (isLastAttempt) {
        logger.error({ err: error, attempts: maxRetries }, 'Database connection failed after max retries');
        throw error;
      }

      logger.warn({ 
        err: error, 
        attempt, 
        maxRetries, 
        retryDelay: delay 
      }, 'Database connection attempt failed, retrying');
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 60s (max)
      delay = Math.min(delay * 2, 60000);
    }
  }
};

/**
 * Start background reconnection monitoring
 * This will periodically check and reconnect if the connection is lost
 */
const startReconnectionMonitoring = () => {
  if (connectionRetryInterval) {
    return; // Already monitoring
  }

  connectionRetryInterval = setInterval(async () => {
    if (!isConnected) {
      try {
        await sequelize.authenticate();
        isConnected = true;
        logger.info('Database reconnection successful');
      } catch (error) {
        // Silently fail - will retry on next interval
        // Don't log every failed attempt to avoid log spam
        // Only log if it's been a while since last connection
      }
    } else {
      // Periodically verify connection is still alive
      try {
        await sequelize.authenticate();
      } catch (error) {
        // Connection lost - mark as disconnected
        isConnected = false;
        logger.warn({ err: error }, 'Database connection lost during health check, will retry automatically');
      }
    }
  }, 10000); // Check every 10 seconds
};

export const connectDatabase = async (options = {}) => {
  const { 
    retryOnFailure = true, 
    maxRetries = 10, 
    allowFailure = false 
  } = options;

  try {
    if (retryOnFailure) {
      await retryConnection(maxRetries);
    } else {
      await sequelize.authenticate();
      isConnected = true;
    }
    
    // Sync database schema (create tables if they don't exist, alter existing tables to add missing columns)
    // Using alter: true will add missing columns without dropping existing data
    // Only sync if we have a connection
    if (isConnected) {
      try {
        await sequelize.sync({ alter: true });
        logger.info('Database schema synchronized');
      } catch (syncError) {
        logger.warn({ err: syncError }, 'Database schema sync failed (non-fatal)');
        // Don't throw - schema sync failures shouldn't prevent app from starting
      }
    }

    // Start background reconnection monitoring
    startReconnectionMonitoring();
  } catch (error) {
    isConnected = false;
    
    if (allowFailure) {
      logger.warn({ err: error }, 'Database connection failed, but continuing anyway. Will retry in background');
      // Start monitoring even if initial connection failed
      startReconnectionMonitoring();
      return;
    }
    
    throw error;
  }
};

export { sequelize };

