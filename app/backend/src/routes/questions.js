import express from 'express';
import { 
  createQuestion, 
  getQuestionsByUser, 
  getQuestionById, 
  updateQuestion, 
  deleteQuestion, 
  createMultipleQuestions,
  getQuestionStats,
  updateQuestionOrder,
  removeQuestionFromAssessment,
  createVariant,
  updateVariant,
  deleteVariant,
  getVariantsByQuestion
} from '../services/questionService.js';
import { generateQuestions, AI_PROVIDERS } from '../services/aiService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/questions
// @desc    Create a new question
// @access  Private
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { content, difficulty, bloomLevel, classId, type, primaryTopicId, questionOrder } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Question content is required'
      });
    }

    const question = await createQuestion(req.user.id, {
      content: content.trim(),
      difficulty,
      bloomLevel,
      classId,
      type,
      primaryTopicId,
      questionOrder
    });

    res.status(201).json({
      success: true,
      message: 'Question created successfully',
      data: question
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/questions
// @desc    Get all questions for the current user
// @access  Private
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { classId, difficulty, search, limit, offset } = req.query;

    const questions = await getQuestionsByUser(req.user.id, {
      classId,
      difficulty,
      search,
      limit,
      offset
    });

    res.json({
      success: true,
      data: questions
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/questions/stats
// @desc    Get question statistics for the current user
// @access  Private
router.get('/stats', authenticateToken, async (req, res, next) => {
  try {
    const stats = await getQuestionStats(req.user.id);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/questions/:id
// @desc    Get a specific question
// @access  Private
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const question = await getQuestionById(req.params.id, req.user.id);

    res.json({
      success: true,
      data: question
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/questions/:id
// @desc    Update a question
// @access  Private
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { content, difficulty, bloomLevel, classId, type, primaryTopicId, questionOrder } = req.body;

    const question = await updateQuestion(req.params.id, req.user.id, {
      content,
      difficulty,
      bloomLevel,
      classId,
      type,
      primaryTopicId,
      questionOrder
    });

    res.json({
      success: true,
      message: 'Question updated successfully',
      data: question
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/questions/:id
// @desc    Delete a question
// @access  Private
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    await deleteQuestion(req.params.id, req.user.id);

    res.json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/questions/generate
// @desc    Generate questions using AI
// @access  Private
router.post('/generate', authenticateToken, async (req, res, next) => {
  try {
    const { prompt, provider = AI_PROVIDERS.GROQ, numQuestions = 15, difficultyDistribution } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    const params = {
      numQuestions: parseInt(numQuestions) || 15,
      difficultyDistribution: difficultyDistribution || {
        easy: 5,
        medium: 5,
        hard: 5
      }
    };

    const questions = await generateQuestions(prompt.trim(), provider, params);

    res.json({
      success: true,
      message: 'Questions generated successfully',
      data: questions
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/questions/approve
// @desc    Approve and save generated questions
// @access  Private
router.post('/approve', authenticateToken, async (req, res, next) => {
  try {
    const { questions, classId } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Questions array is required'
      });
    }

    const savedQuestions = await createMultipleQuestions(req.user.id, questions.map(q => ({
      ...q,
      classId
    })));

    res.status(201).json({
      success: true,
      message: `${savedQuestions.length} questions saved successfully`,
      data: savedQuestions
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/questions/:id/order
// @desc    Update question order in an assessment
// @access  Private
router.put('/:id/order', authenticateToken, async (req, res, next) => {
  try {
    const { assessmentId, orderNumber } = req.body;

    if (!assessmentId || orderNumber === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Assessment ID and order number are required'
      });
    }

    const question = await updateQuestionOrder(
      req.params.id, 
      assessmentId, 
      orderNumber, 
      req.user.id
    );

    res.json({
      success: true,
      message: 'Question order updated successfully',
      data: question
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/questions/:id/order/:assessmentId
// @desc    Remove question from assessment order
// @access  Private
router.delete('/:id/order/:assessmentId', authenticateToken, async (req, res, next) => {
  try {
    const question = await removeQuestionFromAssessment(
      req.params.id, 
      req.params.assessmentId, 
      req.user.id
    );

    res.json({
      success: true,
      message: 'Question removed from assessment order',
      data: question
    });
  } catch (error) {
    next(error);
  }
});

// Variant Management Routes

// @route   POST /api/questions/:id/variants
// @desc    Create a new variant for a question
// @access  Private
router.post('/:id/variants', authenticateToken, async (req, res, next) => {
  try {
    const { questionText, difficulty, assessmentId, secondaryTopicsId, answer, referenceId } = req.body;

    if (!questionText || !questionText.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Question text is required'
      });
    }

    const variant = await createVariant(req.params.id, {
      questionText: questionText.trim(),
      difficulty,
      assessmentId,
      secondaryTopicsId,
      answer,
      referenceId
    }, req.user.id);

    res.status(201).json({
      success: true,
      message: 'Variant created successfully',
      data: variant
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/questions/:id/variants
// @desc    Get all variants for a question
// @access  Private
router.get('/:id/variants', authenticateToken, async (req, res, next) => {
  try {
    const variants = await getVariantsByQuestion(req.params.id, req.user.id);

    res.json({
      success: true,
      data: variants
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/questions/variants/:variantId
// @desc    Update a variant
// @access  Private
router.put('/variants/:variantId', authenticateToken, async (req, res, next) => {
  try {
    const { questionText, difficulty, assessmentId, secondaryTopicsId, answer, referenceId } = req.body;

    const variant = await updateVariant(req.params.variantId, {
      questionText,
      difficulty,
      assessmentId,
      secondaryTopicsId,
      answer,
      referenceId
    }, req.user.id);

    res.json({
      success: true,
      message: 'Variant updated successfully',
      data: variant
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/questions/variants/:variantId
// @desc    Delete a variant
// @access  Private
router.delete('/variants/:variantId', authenticateToken, async (req, res, next) => {
  try {
    await deleteVariant(req.params.variantId, req.user.id);

    res.json({
      success: true,
      message: 'Variant deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;

