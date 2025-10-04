import { Question_Metadata, Variants } from '../schema/index.js';
import { Course } from '../schema/Course.js';
import { Op } from 'sequelize';

const normalizeSecondaryTopics = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item));
  }

  if (value === undefined || value === null || value === '') {
    return [];
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? [value] : [];
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item));
  }

  return [];
};

export const createQuestion = async (userId, questionData) => {
  try {
    const {
      description,
      courseId,
      primaryTopicId,
      type = 'MCQ',
      questionOrder = {}
    } = questionData;

    if (!description || !description.trim()) {
      throw new Error('Question description is required');
    }

    const parsedCourseId = Number(courseId);
    if (!Number.isInteger(parsedCourseId)) {
      throw new Error('Valid courseId is required');
    }

    const parsedPrimaryTopicId = Number(primaryTopicId);
    if (!Number.isInteger(parsedPrimaryTopicId)) {
      throw new Error('Valid primaryTopicId is required');
    }

    const course = await Course.findOne({
      where: { id: parsedCourseId, userId },
      attributes: ['id']
    });

    if (!course) {
      throw new Error('Course not found');
    }

    const allowedTypes = ['MCQ', 'SA'];
    const normalizedType = allowedTypes.includes(type) ? type : 'MCQ';

    const question = await Question_Metadata.create({
      courseId: parsedCourseId,
      primaryTopicId: parsedPrimaryTopicId,
      type: normalizedType,
      description: description.trim(),
      questionOrder: questionOrder && typeof questionOrder === 'object' ? questionOrder : {}
    });

    return question;
  } catch (error) {
    throw error;
  }
};

export const getQuestionsByUser = async (userId, options = {}) => {
  try {
    const { courseId, search, limit = 50, offset = 0 } = options;
    
    // Build where clause for Question_Metadata
    const whereClause = {};
    
    if (courseId) {
      const parsedCourseId = Number(courseId);
      if (Number.isInteger(parsedCourseId)) {
        whereClause.courseId = parsedCourseId;
      }
    }

    const questions = await Question_Metadata.findAll({
      where: whereClause,
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'name', 'code'],
          where: { userId: userId } // Filter by user through course relationship
        },
        {
          model: Variants,
          as: 'variants',
          attributes: ['id', 'questionText', 'difficulty', 'answer', 'assessmentId', 'secondaryTopicsId']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Apply search filter if provided
    let filteredQuestions = questions;
    if (search) {
      filteredQuestions = questions.filter(q => 
        q.description.toLowerCase().includes(search.toLowerCase())
      );
    }

    return filteredQuestions;
  } catch (error) {
    throw error;
  }
};

export const getQuestionById = async (questionId, userId) => {
  try {
    const question = await Question_Metadata.findOne({
      where: { id: questionId },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'name', 'code'],
          where: { userId: userId } // Ensure user owns the course
        },
        {
          model: Variants,
          as: 'variants',
          attributes: ['id', 'questionText', 'difficulty', 'answer', 'assessmentId', 'secondaryTopicsId']
        }
      ]
    });

    if (!question) {
      throw new Error('Question not found');
    }

    return question;
  } catch (error) {
    throw error;
  }
};

export const updateQuestion = async (questionId, userId, updateData) => {
  try {
    const question = await Question_Metadata.findOne({
      where: { id: questionId },
      include: [
        {
          model: Course,
          as: 'course',
          where: { userId: userId } // Ensure user owns the course
        }
      ]
    });

    if (!question) {
      throw new Error('Question not found');
    }

    const updates = { ...updateData };

    if (updates.description !== undefined && updates.description !== null) {
      if (!updates.description.toString().trim()) {
        throw new Error('Question description cannot be empty');
      }
      updates.description = updates.description.toString().trim();
    }

    if (updates.courseId !== undefined) {
      const parsedCourseId = Number(updates.courseId);
      if (!Number.isInteger(parsedCourseId)) {
        throw new Error('Valid courseId is required');
      }

      const course = await Course.findOne({
        where: { id: parsedCourseId, userId },
        attributes: ['id']
      });

      if (!course) {
        throw new Error('Course not found');
      }

      updates.courseId = parsedCourseId;
    }

    if (updates.primaryTopicId !== undefined) {
      const parsedPrimaryTopicId = Number(updates.primaryTopicId);
      if (!Number.isInteger(parsedPrimaryTopicId)) {
        throw new Error('Valid primaryTopicId is required');
      }
      updates.primaryTopicId = parsedPrimaryTopicId;
    }

    if (updates.type !== undefined) {
      const allowedTypes = ['MCQ', 'SA'];
      if (!allowedTypes.includes(updates.type)) {
        throw new Error(`Invalid question type. Allowed values: ${allowedTypes.join(', ')}`);
      }
    }

    if (updates.questionOrder !== undefined && typeof updates.questionOrder !== 'object') {
      throw new Error('questionOrder must be an object');
    }

    await question.update(updates);
    return question;
  } catch (error) {
    throw error;
  }
};

export const deleteQuestion = async (questionId, userId) => {
  try {
    const question = await Question_Metadata.findOne({
      where: { id: questionId },
      include: [
        {
          model: Course,
          as: 'course',
          where: { userId: userId } // Ensure user owns the course
        }
      ]
    });

    if (!question) {
      throw new Error('Question not found');
    }

    await question.destroy();
    return true;
  } catch (error) {
    throw error;
  }
};

export const createMultipleQuestions = async (userId, questionsData) => {
  try {
    const createdQuestions = [];

    for (const q of questionsData) {
      const description = q.description ?? q.content;
      const courseId = Number(q.courseId ?? q.classId);
      const primaryTopicId = Number(q.primaryTopicId ?? 1);
      const type = ['MCQ', 'SA'].includes(q.type) ? q.type : 'MCQ';
      const questionOrder = q.questionOrder || {};

      const question = await createQuestion(userId, {
        description,
        courseId,
        primaryTopicId,
        type,
        questionOrder
      });

      createdQuestions.push(question);
    }

    return createdQuestions;
  } catch (error) {
    throw error;
  }
};

export const getQuestionStats = async (userId) => {
  try {
    // Count questions for this user through course relationship
    const totalQuestions = await Question_Metadata.count({
      include: [
        {
          model: Course,
          as: 'course',
          where: { userId: userId }
        }
      ]
    });
    
    const typeStats = await Question_Metadata.findAll({
      attributes: [
        'type',
        [Question_Metadata.sequelize.fn('COUNT', Question_Metadata.sequelize.col('id')), 'count']
      ],
      include: [
        {
          model: Course,
          as: 'course',
          where: { userId: userId }
        }
      ],
      group: ['type']
    });

    return {
      totalQuestions,
      typeStats
    };
  } catch (error) {
    throw error;
  }
};

export const updateQuestionOrder = async (questionId, assessmentId, orderNumber, userId) => {
  try {
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

    // Get current questionOrder or initialize empty object
    const currentOrder = question.questionOrder || {};
    
    // Update the order for the specific assessment
    currentOrder[assessmentId] = orderNumber;
    
    // Update the question with new order
    await question.update({ questionOrder: currentOrder });
    
    return question;
  } catch (error) {
    throw error;
  }
};

export const removeQuestionFromAssessment = async (questionId, assessmentId, userId) => {
  try {
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

    // Get current questionOrder or initialize empty object
    const currentOrder = question.questionOrder || {};
    
    // Remove the assessment from the order
    delete currentOrder[assessmentId];
    
    // Update the question with new order
    await question.update({ questionOrder: currentOrder });
    
    return question;
  } catch (error) {
    throw error;
  }
};

// Variant Management Functions
export const createVariant = async (questionId, variantData, userId) => {
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

    const secondaryTopics = normalizeSecondaryTopics(variantData.secondaryTopicsId);

    const variant = await Variants.create({
      questionMetadataId: questionId,
      questionText: variantData.questionText,
      difficulty: variantData.difficulty || 'medium',
      assessmentId: variantData.assessmentId || null,
      secondaryTopicsId: secondaryTopics,
      answer: variantData.answer || null,
      referenceId: variantData.referenceId || null
    });

    return variant;
  } catch (error) {
    throw error;
  }
};

export const updateVariant = async (variantId, variantData, userId) => {
  try {
    const variant = await Variants.findOne({
      where: { id: variantId },
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
    });

    if (!variant) {
      throw new Error('Variant not found');
    }

    const normalizedData = {
      ...variantData,
      ...(variantData.secondaryTopicsId !== undefined && {
        secondaryTopicsId: normalizeSecondaryTopics(variantData.secondaryTopicsId)
      })
    };

    await variant.update(normalizedData);
    return variant;
  } catch (error) {
    throw error;
  }
};

export const deleteVariant = async (variantId, userId) => {
  try {
    const variant = await Variants.findOne({
      where: { id: variantId },
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
    });

    if (!variant) {
      throw new Error('Variant not found');
    }

    await variant.destroy();
    return true;
  } catch (error) {
    throw error;
  }
};

export const getVariantsByQuestion = async (questionId, userId) => {
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

    const variants = await Variants.findAll({
      where: { questionMetadataId: questionId },
      order: [['createdAt', 'ASC']]
    });

    return variants;
  } catch (error) {
    throw error;
  }
};
