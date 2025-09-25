import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Question_Metadata = sequelize.define('Question_Metadata', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('MCQ', 'SA'),
    allowNull: false
  },
  courseId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'course_id',
    references: {
      model: 'courses',
      key: 'id'
    }
  },
  primaryTopicId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'primary_topic_id',
    references: {
      model: 'topics',
      key: 'id'
    }
  },
  questionOrder: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'question_order'
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
  tableName: 'question_metadata',
  timestamps: true,
  underscored: true
});
