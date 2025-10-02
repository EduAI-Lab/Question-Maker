import { Question_Metadata, Variants } from '../schema/index.js';
import { Course } from '../schema/Course.js';
import { Op } from 'sequelize';

export const createQuestion = async (userId, questionData) => {
  try {
    const { 
      content, 
      difficulty = 'medium', 
      bloomLevel = 'understand', 
      classId, 
      primaryTopicId,
      type = 'MCQ',
      questionOrder = {}
    } = questionData;

    const question = await Question_Metadata.create({
      courseId: classId || null,
      primaryTopicId: primaryTopicId || 1, // Default to topic 1, should be provided
      type: type,
      description: content,
      questionOrder: questionOrder
    });

    return question;
  } catch (error) {
    throw error;
  }
};

export const getQuestionsByUser = async (userId, options = {}) => {
  try {
    const { classId, difficulty, search, limit = 50, offset = 0 } = options;
    
    // Build where clause for Question_Metadata
    const whereClause = {};
    
    if (classId) {
      whereClause.courseId = classId;
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

    await question.update(updateData);
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
    const questions = await Question_Metadata.bulkCreate(
      questionsData.map(q => ({
        courseId: q.classId || null,
        primaryTopicId: q.primaryTopicId || 1, // Default to topic 1
        type: q.type || 'MCQ',
        description: q.content,
        questionOrder: q.questionOrder || {}
      }))
    );

    return questions;
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

    const variant = await Variants.create({
      questionMetadataId: questionId,
      questionText: variantData.questionText,
      difficulty: variantData.difficulty || 'medium',
      assessmentId: variantData.assessmentId || null,
      secondaryTopicsId: variantData.secondaryTopicsId || null,
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

    await variant.update(variantData);
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

