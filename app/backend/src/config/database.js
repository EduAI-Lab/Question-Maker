import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
  console.warn(`⚠️  Warning: Could not load .env file from ${envPath}:`, result.error.message);
}

if (!process.env.DATABASE_URL) {
  console.error(`❌ Error: DATABASE_URL is not set.`);
  console.error(`   Looking for .env at: ${envPath}`);
  console.error(`   Project root: ${projectRoot}`);
  throw new Error('DATABASE_URL environment variable is required. Please set it in your .env file.');
}

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

export const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    
    // Sync database schema (create tables if they don't exist)
    await sequelize.sync();
  } catch (error) {
    throw error;
  }
};

export { sequelize };

