import { Question_Metadata, Variants, Topics, sequelize } from '../schema/index.js';
import { Course } from '../schema/Course.js';

const VALID_Q_TYPES = ['MCQ', 'SA'];
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];

export const createQuestion = async (userId, questionData) => {
  try {
    const { content, difficulty = 'medium', bloomLevel = 'understand', classId } = questionData;

    const question = await Question.create({
      userId,
      content,
      difficulty,
      bloomLevel,
      classId: classId || null
    });

    return question;
  } catch (error) {
    throw error;
  }
};

export const getQuestionsByUser = async (userId, options = {}) => {
  try {
    const { classId, difficulty, search, limit = 50, offset = 0 } = options;
    
    const whereClause = { userId };
    
    if (classId) {
      whereClause.classId = classId;
    }
    
    if (difficulty && difficulty !== 'all') {
      whereClause.difficulty = difficulty;
    }

    const questions = await Question.findAll({
      where: whereClause,
      include: [
        {
          model: Class,
          as: 'class',
          attributes: ['id', 'name', 'subject']
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
        q.content.toLowerCase().includes(search.toLowerCase())
      );
    }

    return filteredQuestions;
  } catch (error) {
    throw error;
  }
};

export const getQuestionById = async (questionId, userId) => {
  try {
    const question = await Question.findOne({
      where: { id: questionId, userId },
      include: [
        {
          model: Class,
          as: 'class',
          attributes: ['id', 'name', 'subject']
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
    const question = await Question.findOne({
      where: { id: questionId, userId }
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
    const question = await Question.findOne({
      where: { id: questionId, userId }
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
    const questions = await Question.bulkCreate(
      questionsData.map(q => ({
        userId,
        content: q.content,
        difficulty: q.difficulty || 'medium',
        bloomLevel: q.bloom_level || 'understand',
        classId: q.classId || null
      }))
    );

    return questions;
  } catch (error) {
    throw error;
  }
};

export const getQuestionStats = async (userId) => {
  try {
    const totalQuestions = await Question.count({ where: { userId } });
    
    const difficultyStats = await Question.findAll({
      where: { userId },
      attributes: [
        'difficulty',
        [Question.sequelize.fn('COUNT', Question.sequelize.col('id')), 'count']
      ],
      group: ['difficulty']
    });

    const bloomLevelStats = await Question.findAll({
      where: { userId },
      attributes: [
        'bloomLevel',
        [Question.sequelize.fn('COUNT', Question.sequelize.col('id')), 'count']
      ],
      group: ['bloomLevel']
    });

    return {
      totalQuestions,
      difficultyStats,
      bloomLevelStats
    };
  } catch (error) {
    throw error;
  }
};

export const saveExtractedQuestions = async (userId, payload) => {
  const {
    courseId,
    topicId,
    topicName,
    type = 'SA',
    defaultDifficulty = 'medium',
    questions = []
  } = payload || {};

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Questions array is required');
  }

  if (!courseId) {
    throw new Error('courseId is required');
  }

  const course = await Course.findOne({ where: { id: courseId, userId } });
  if (!course) {
    throw new Error('Course not found or does not belong to the current user');
  }

  const normalizedType = VALID_Q_TYPES.includes(type) ? type : 'SA';
  const normalizedDefaultDifficulty = VALID_DIFFICULTIES.includes(defaultDifficulty)
    ? defaultDifficulty
    : 'medium';

  const ensureTopic = async () => {
    if (topicId) {
      const existingTopic = await Topics.findOne({
        where: { id: topicId, courseId }
      });

      if (!existingTopic) {
        throw new Error('Provided topic does not exist for the selected course');
      }

      return existingTopic.id;
    }

    const fallbackName = topicName?.trim() || 'General';
    const [topic] = await Topics.findOrCreate({
      where: { courseId, name: fallbackName },
      defaults: { courseId, name: fallbackName }
    });

    return topic.id;
  };

  const primaryTopicId = await ensureTopic();

  const transaction = await sequelize.transaction();

  try {
    const saved = [];

    for (let index = 0; index < questions.length; index++) {
      const rawEntry = questions[index] || {};
      const questionText = (rawEntry.question || rawEntry.content || '').toString().trim();
      const instructions = (rawEntry.instructions || '').toString().trim();
      const itemDifficulty = VALID_DIFFICULTIES.includes(rawEntry.difficulty)
        ? rawEntry.difficulty
        : normalizedDefaultDifficulty;

      if (!questionText) {
        continue;
      }

      const metadata = await Question_Metadata.create({
        description: instructions || null,
        type: normalizedType,
        courseId,
        primaryTopicId,
        questionOrder: index + 1
      }, { transaction });

      const variant = await Variants.create({
        questionText: instructions ? `${instructions}\n\n${questionText}` : questionText,
        difficulty: itemDifficulty,
        questionMetadataId: metadata.id,
        assessmentId: null,
        secondaryTopicsId: null,
        referenceId: null,
        answer: null
      }, { transaction });

      saved.push({
        metadata: metadata.get({ plain: true }),
        variant: variant.get({ plain: true })
      });
    }

    if (saved.length === 0) {
      throw new Error('No valid questions found to save');
    }

    await transaction.commit();

    return saved;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
