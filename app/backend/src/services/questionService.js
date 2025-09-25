import { Question_Metadata, Variants } from '../schema/index.js';
import { Course } from '../schema/Course.js';

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

