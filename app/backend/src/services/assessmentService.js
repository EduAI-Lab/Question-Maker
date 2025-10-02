import { Assessments, Question_Metadata, Variants, sequelize } from '../schema/index.js';
import { Course } from '../schema/Course.js';
import { Op } from 'sequelize';

export const createAssessment = async (userId, assessmentData) => {
  try {
    const { type, name, semester } = assessmentData;

    if (!type || !name || !semester) {
      throw new Error('Type, name, and semester are required');
    }

    const assessment = await Assessments.create({
      type,
      name,
      semester
    });

    return assessment;
  } catch (error) {
    throw error;
  }
};

export const getAssessmentsByUser = async (userId, options = {}) => {
  try {
    const { limit = 50, offset = 0 } = options;

    const assessments = await Assessments.findAll({
      include: [
        {
          model: Variants,
          as: 'variants',
          attributes: ['id', 'questionText', 'difficulty', 'answer'],
          include: [
            {
              model: Question_Metadata,
              as: 'questionMetadata',
              attributes: ['id', 'description', 'type', 'questionOrder'],
              include: [
                {
                  model: Course,
                  as: 'course',
                  where: { userId: userId },
                  attributes: ['id', 'name', 'code']
                }
              ]
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return assessments;
  } catch (error) {
    throw error;
  }
};

export const getAssessmentById = async (assessmentId, userId) => {
  try {
    const assessment = await Assessments.findOne({
      where: { id: assessmentId },
      include: [
        {
          model: Variants,
          as: 'variants',
          attributes: ['id', 'questionText', 'difficulty', 'answer'],
          include: [
            {
              model: Question_Metadata,
              as: 'questionMetadata',
              attributes: ['id', 'description', 'type', 'questionOrder'],
              include: [
                {
                  model: Course,
                  as: 'course',
                  where: { userId: userId },
                  attributes: ['id', 'name', 'code']
                }
              ]
            }
          ]
        }
      ]
    });

    if (!assessment) {
      throw new Error('Assessment not found');
    }

    return assessment;
  } catch (error) {
    throw error;
  }
};

export const updateAssessment = async (assessmentId, updateData, userId) => {
  try {
    const assessment = await Assessments.findOne({
      where: { id: assessmentId },
      include: [
        {
          model: Variants,
          as: 'variants',
          include: [
            {
              model: Question_Metadata,
              as: 'questionMetadata',
              include: [
                {
                  model: Course,
                  as: 'course',
                  where: { userId: userId }
                }
              ]
            }
          ]
        }
      ]
    });

    if (!assessment) {
      throw new Error('Assessment not found');
    }

    await assessment.update(updateData);
    return assessment;
  } catch (error) {
    throw error;
  }
};

export const deleteAssessment = async (assessmentId, userId) => {
  try {
    const assessment = await Assessments.findOne({
      where: { id: assessmentId },
      include: [
        {
          model: Variants,
          as: 'variants',
          include: [
            {
              model: Question_Metadata,
              as: 'questionMetadata',
              include: [
                {
                  model: Course,
                  as: 'course',
                  where: { userId: userId }
                }
              ]
            }
          ]
        }
      ]
    });

    if (!assessment) {
      throw new Error('Assessment not found');
    }

    await assessment.destroy();
    return true;
  } catch (error) {
    throw error;
  }
};

export const addQuestionToAssessment = async (assessmentId, questionId, orderNumber, userId) => {
  try {
    // Verify user owns the question
    const question = await Question_Metadata.findOne({
      where: { id: questionId },
      include: [
        {
          model: Course,
          as: 'course',
          where: { userId: userId }
        }
      ]
    });

    if (!question) {
      throw new Error('Question not found');
    }

    // Verify assessment exists
    const assessment = await Assessments.findByPk(assessmentId);
    if (!assessment) {
      throw new Error('Assessment not found');
    }

    // Update question order
    const currentOrder = question.questionOrder || {};
    currentOrder[assessmentId] = orderNumber;
    
    await question.update({ questionOrder: currentOrder });

    return question;
  } catch (error) {
    throw error;
  }
};

export const removeQuestionFromAssessment = async (assessmentId, questionId, userId) => {
  try {
    // Verify user owns the question
    const question = await Question_Metadata.findOne({
      where: { id: questionId },
      include: [
        {
          model: Course,
          as: 'course',
          where: { userId: userId }
        }
      ]
    });

    if (!question) {
      throw new Error('Question not found');
    }

    // Remove from question order
    const currentOrder = question.questionOrder || {};
    delete currentOrder[assessmentId];
    
    await question.update({ questionOrder: currentOrder });

    return question;
  } catch (error) {
    throw error;
  }
};

export const getQuestionsInAssessment = async (assessmentId, userId) => {
  try {
    // Verify assessment exists
    const assessment = await Assessments.findByPk(assessmentId);
    if (!assessment) {
      throw new Error('Assessment not found');
    }

    // Get all questions that have this assessment in their questionOrder
    const questions = await Question_Metadata.findAll({
      where: {
        questionOrder: {
          [Op.contains]: { [assessmentId]: { [Op.ne]: null } }
        }
      },
      include: [
        {
          model: Course,
          as: 'course',
          where: { userId: userId },
          attributes: ['id', 'name', 'code']
        },
        {
          model: Variants,
          as: 'variants',
          where: { assessmentId: assessmentId },
          attributes: ['id', 'questionText', 'difficulty', 'answer']
        }
      ],
      order: [
        [sequelize.literal(`CAST(question_order->>'${assessmentId}' AS INTEGER)`), 'ASC']
      ]
    });

    return questions;
  } catch (error) {
    throw error;
  }
};
