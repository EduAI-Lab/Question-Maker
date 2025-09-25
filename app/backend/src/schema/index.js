import { sequelize } from '../config/database.js';
import { User } from './User.js';
import { Course } from './Course.js';
import { Topics } from './Topics.js';
import { Question_Metadata } from './Question_Metadata.js';
import { Assessments } from './Assessments.js';
import { Variants } from './Variants.js';

// Define associations

// User associations
User.hasMany(Course, { foreignKey: 'userId', as: 'courses' });
Course.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Course associations
Course.hasMany(Topics, { foreignKey: 'courseId', as: 'topics' });
Topics.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

Course.hasMany(Question_Metadata, { foreignKey: 'courseId', as: 'questionMetadata' });
Question_Metadata.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

// Topics associations
Topics.hasMany(Question_Metadata, { foreignKey: 'primaryTopicId', as: 'primaryQuestions' });
Question_Metadata.belongsTo(Topics, { foreignKey: 'primaryTopicId', as: 'primaryTopic' });

Topics.hasMany(Variants, { foreignKey: 'secondaryTopicsId', as: 'secondaryVariants' });
Variants.belongsTo(Topics, { foreignKey: 'secondaryTopicsId', as: 'secondaryTopic' });

// Question_Metadata associations
Question_Metadata.hasMany(Variants, { foreignKey: 'questionMetadataId', as: 'variants' });
Variants.belongsTo(Question_Metadata, { foreignKey: 'questionMetadataId', as: 'questionMetadata' });

// Assessments associations
Assessments.hasMany(Variants, { foreignKey: 'assessmentId', as: 'variants' });
Variants.belongsTo(Assessments, { foreignKey: 'assessmentId', as: 'assessment' });

// Variants self-reference for referenceId
Variants.hasMany(Variants, { foreignKey: 'referenceId', as: 'referencedVariants' });
Variants.belongsTo(Variants, { foreignKey: 'referenceId', as: 'originalVariant' });

export {
  sequelize,
  User,
  Course,
  Topics,
  Question_Metadata,
  Assessments,
  Variants
};
