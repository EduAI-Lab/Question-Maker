import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Question = sequelize.define('Question', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  classId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'class_id',
    references: {
      model: 'classes',
      key: 'id'
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  difficulty: {
    type: DataTypes.ENUM('easy', 'medium', 'hard'),
    allowNull: false,
    defaultValue: 'medium'
  },
  bloomLevel: {
    type: DataTypes.ENUM('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'),
    allowNull: false,
    defaultValue: 'understand',
    field: 'bloom_level'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  tableName: 'questions',
  timestamps: true,
  underscored: true
});

