import { Question_Metadata, Variants, Topics, Assessments } from '../schema/index.js';
import { Course } from '../schema/Course.js';

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

const generateMetadataDescription = (questionText, summary, instructions) => {
  const candidate = [summary, instructions, questionText].find(
    (value) => typeof value === 'string' && value.trim().length > 0
  );

  if (!candidate) {
    return 'Question';
  }

  const normalized = candidate.replace(/\s+/g, ' ').trim();
  const sentenceMatch = normalized.match(/[^.!?]+[.!?]?/);
  const base = (sentenceMatch ? sentenceMatch[0] : normalized).trim();
  const words = base.split(' ');

  if (words.length <= 12) {
    return base;
  }

  return `${words.slice(0, 12).join(' ')}…`;
};

export const createQuestion = async (userId, questionData) => {
  try {
    const {
      description,
      courseId,
      primaryTopicId,
      type = 'MCQ',
      questionOrder = {},
      isAiGenerated = false,
      isDraft = true // All new questions start as drafts until reviewed
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
      questionOrder: questionOrder && typeof questionOrder === 'object' ? questionOrder : {},
      isAiGenerated: Boolean(isAiGenerated),
      isDraft: Boolean(isDraft)
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

    if (updates.isAiGenerated !== undefined) { //mock for AI generated questions
      updates.isAiGenerated = Boolean(updates.isAiGenerated);
    }

    if (updates.isDraft !== undefined) {
      updates.isDraft = Boolean(updates.isDraft);
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

export const saveExtractedQuestions = async (userId, payload) => {
  const { courseId, primaryTopicId, topicName, questions, assessment, isAiGenerated = false } = payload;

  if (!courseId) {
    throw new Error('courseId is required');
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Questions array is required');
  }

  const course = await Course.findOne({
    where: { id: Number(courseId), userId },
    attributes: ['id']
  });

  if (!course) {
    throw new Error('Course not found');
  }

  const transaction = await Question_Metadata.sequelize.transaction();

  try {
    const existingTopics = await Topics.findAll({
      where: { courseId },
      transaction
    });
    const topicIdSet = new Set(existingTopics.map((topic) => topic.id));

    let fallbackTopicId = primaryTopicId ? Number(primaryTopicId) : null;
    if (fallbackTopicId && !topicIdSet.has(fallbackTopicId)) {
      const fallbackTopic = await Topics.findOne({
        where: { id: fallbackTopicId, courseId },
        transaction
      });

      if (!fallbackTopic) {
        throw new Error('Primary topic not found for this course');
      }

      topicIdSet.add(fallbackTopicId);
    }

    const sanitizedTopicName = topicName ? topicName.trim() : '';

    const ensureFallbackTopic = async () => {
      if (fallbackTopicId && topicIdSet.has(fallbackTopicId)) {
        return fallbackTopicId;
      }

      if (sanitizedTopicName) {
        let topic = await Topics.findOne({
          where: { name: sanitizedTopicName, courseId },
          transaction
        });

        if (!topic) {
          topic = await Topics.create({
            name: sanitizedTopicName,
            courseId
          }, { transaction });
        }

        topicIdSet.add(topic.id);
        fallbackTopicId = topic.id;
        return fallbackTopicId;
      }

      if (topicIdSet.size === 0) {
        const autoTopic = await Topics.create({
          name: 'Uploaded Questions',
          courseId
        }, { transaction });
        topicIdSet.add(autoTopic.id);
        fallbackTopicId = autoTopic.id;
        return fallbackTopicId;
      }

      const firstTopic = existingTopics[0];
      fallbackTopicId = firstTopic ? firstTopic.id : null;
      return fallbackTopicId;
    };

    let createdAssessment = null;
    if (assessment) {
      const { type, name, semester } = assessment;
      if (!type || !name || !semester) {
        throw new Error('Assessment type, name, and semester are required.');
      }
      createdAssessment = await Assessments.create({
        type,
        name,
        semester
      }, { transaction });
    }

    const createdIds = [];
    let orderCounter = 1;

    for (const item of questions) {
      const questionText = typeof item.question === 'string' ? item.question.trim() : '';
      if (!questionText) {
        continue;
      }

      const difficulty = typeof item.difficulty === 'string'
        ? item.difficulty.toLowerCase().trim()
        : '';

      const questionType = typeof item.type === 'string' && ['MCQ', 'SA'].includes(item.type)
        ? item.type
        : 'SA';

      const summary = typeof item.summary === 'string' ? item.summary.trim() : '';
      if (!summary) {
        throw new Error('Each question must include an AI-generated summary.');
      }

      const summaryText = generateMetadataDescription(
        questionText,
        summary,
        item.instructions
      );

      let primaryTopicForQuestion = null;
      if (item.primaryTopicId !== undefined && item.primaryTopicId !== null) {
        const candidate = Number(item.primaryTopicId);
        if (Number.isInteger(candidate) && topicIdSet.has(candidate)) {
          primaryTopicForQuestion = candidate;
        }
      }

      if (!primaryTopicForQuestion) {
        const fallback = await ensureFallbackTopic();
        if (!fallback) {
          throw new Error('Unable to determine primary topic for question.');
        }
        primaryTopicForQuestion = fallback;
      }

      const secondaryTopics = normalizeSecondaryTopics(item.secondaryTopicIds)
        .filter((id) => topicIdSet.has(id) && id !== primaryTopicForQuestion);

      const metadata = await Question_Metadata.create({
        description: summaryText,
        courseId,
        primaryTopicId: primaryTopicForQuestion,
        type: questionType,
        questionOrder: createdAssessment ? { [createdAssessment.id]: orderCounter } : {},
        isAiGenerated: Boolean(isAiGenerated)
      }, { transaction });

      await Variants.create({
        questionMetadataId: metadata.id,
        questionText,
        difficulty: ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium',
        answer: typeof item.answer === 'string' && item.answer.trim() ? item.answer.trim() : null,
        assessmentId: createdAssessment ? createdAssessment.id : null,
        secondaryTopicsId: secondaryTopics,
        referenceId: null
      }, { transaction });

      createdIds.push(metadata.id);
      if (createdAssessment) {
        orderCounter += 1;
      }
    }

    if (createdIds.length === 0) {
      await transaction.rollback();
      throw new Error('No valid questions to save.');
    }

    await transaction.commit();

    const savedQuestions = await Question_Metadata.findAll({
      where: { id: createdIds },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'name', 'code'],
          where: { userId }
        },
        {
          model: Variants,
          as: 'variants'
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    return savedQuestions.map((question) => question.toJSON());
  } catch (error) {
    await transaction.rollback();
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
