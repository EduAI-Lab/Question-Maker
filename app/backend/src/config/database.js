import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import { 
  User, 
  Course, 
  Topics, 
  Question_Metadata, 
  Assessments, 
  Variants 
} from '../schema/index.js';

dotenv.config();

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

