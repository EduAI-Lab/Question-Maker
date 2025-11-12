import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const CanvasIntegration = sequelize.define('CanvasIntegration', {
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
  canvasUrl: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'canvas_url',
    validate: {
      isUrl: true
    }
  },
  apiKey: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'api_key',
    comment: 'Encrypted Canvas API key'
  },
  isTestMode: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_test_mode',
    comment: 'Enable test mode to simulate Canvas API without actual connection'
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
  tableName: 'canvas_integrations',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['user_id']
    }
  ]
});

