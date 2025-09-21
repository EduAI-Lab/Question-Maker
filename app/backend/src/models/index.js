import { sequelize } from '../config/database.js';
import { User } from './User.js';
import { Question } from './Question.js';
import { Class } from './Class.js';
import { Draft } from './Draft.js';

// Define associations
User.hasMany(Question, { foreignKey: 'userId', as: 'questions' });
Question.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Class, { foreignKey: 'userId', as: 'classes' });
Class.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Draft, { foreignKey: 'userId', as: 'drafts' });
Draft.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Class.hasMany(Question, { foreignKey: 'classId', as: 'questions' });
Question.belongsTo(Class, { foreignKey: 'classId', as: 'class' });

Class.hasMany(Draft, { foreignKey: 'classId', as: 'drafts' });
Draft.belongsTo(Class, { foreignKey: 'classId', as: 'class' });

export {
  sequelize,
  User,
  Question,
  Class,
  Draft
};

