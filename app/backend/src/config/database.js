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
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
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
    console.log('✅ Database connection established successfully');
    
    // Force recreate database schema in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Recreating database schema...');
      await sequelize.sync({ force: true });
      console.log('✅ Database schema recreated successfully');
    }
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    throw error;
  }
};

export { sequelize };

