/**
 * Router for EduAI proxy endpoints, enabling chat, question generation, and metadata retrieval.
 * All routes require authentication and delegate to eduaiService for actual API interactions.
 */
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import eduaiService from '../services/eduaiService.js';
import { generateBatchQuestions } from '../services/batchGenerationService.js';
import { Course } from '../schema/Course.js';

const router = express.Router();

/** POST /api/eduai/chat – proxies streaming chat prompts to EduAI with the given course code. */
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { messages, model, apiKeys, courseCode, streaming } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (!courseCode) {
      return res.status(400).json({ error: 'Course code is required' });
    }

    // Note: EduAI manages its own course context, so we don't need to validate
    // against our local database. EduAI will handle course access validation.
    // We'll create a placeholder course object for the response.
    const course = {
      id: 0,
      name: `EduAI Course: ${courseCode}`,
      code: courseCode
    };

    // Call EduAI service
    const response = await eduaiService.chat({
      messages,
      model: model || 'google:gemini-2.5-flash',
      apiKeys: apiKeys || {},
      courseCode,
      streaming: streaming || false
    });

    res.json({
      success: true,
      data: response,
      course: {
        id: course.id,
        name: course.name,
        code: course.code
      }
    });
  } catch (error) {
    console.error('EduAI chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process chat request',
      details: error.message 
    });
  }
});

/** POST /api/eduai/generate-questions – requests generated questions from EduAI using the provided prompt and options. */
router.post('/generate-questions', authenticateToken, async (req, res) => {
  try {
    const { 
      prompt, 
      courseCode, 
      model, 
      apiKeys, 
      numQuestions, 
      difficultyDistribution,
      reasoningDistribution 
    } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!prompt || !courseCode) {
      return res.status(400).json({ 
        error: 'Prompt and course code are required' 
      });
    }

    // Note: EduAI manages its own course context, so we don't need to validate
    // against our local database. EduAI will handle course access validation.
    // We'll create a placeholder course object for the response.
    const course = {
      id: 0,
      name: `EduAI Course: ${courseCode}`,
      code: courseCode
    };

    // Call EduAI service to generate questions
    const questions = await eduaiService.generateQuestions({
      prompt,
      courseCode,
      model: model || 'google:gemini-2.5-flash',
      apiKeys: apiKeys || {},
      numQuestions: numQuestions || 5,
      difficultyDistribution: difficultyDistribution || { easy: 1, medium: 2, hard: 2 },
      reasoningDistribution: reasoningDistribution || { factual: 40, analytical: 30, application: 30 }
    });

    res.json({
      success: true,
      data: {
        questions,
        count: questions.length,
        course: {
          id: course.id,
          name: course.name,
          code: course.code
        }
      }
    });
  } catch (error) {
    console.error('EduAI question generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate questions',
      details: error.message 
    });
  }
});

/** GET /api/eduai/courses – fetches the list of EduAI-managed courses for selection. */
router.get('/courses', authenticateToken, async (req, res) => {
  try {
    const coursesData = await eduaiService.listCourses();

    res.json({
      success: true,
      data: coursesData
    });
  } catch (error) {
    console.error('EduAI list courses error:', error);
    res.status(500).json({
      error: 'Failed to retrieve courses from EduAI',
      details: error.message
    });
  }
});

/** GET /api/eduai/courses/:courseId/topics – retrieves EduAI topics for the given course ID. */
router.get('/courses/:courseId/topics', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!courseId) {
      return res.status(400).json({ error: 'Course ID is required' });
    }

    const topics = await eduaiService.getCourseTopics(courseId);

    res.json({
      success: true,
      data: topics
    });
  } catch (error) {
    console.error('EduAI course topics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve topics from EduAI',
      details: error.message
    });
  }
});

/** GET /api/eduai/test-api-key – validates that the configured EduAI credentials work. */
router.get('/test-api-key', authenticateToken, async (req, res) => {
  try {
    const result = await eduaiService.testApiKey();

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: result.response
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        statusCode: result.statusCode
      });
    }
  } catch (error) {
    console.error('EduAI API key test error:', error);
    res.status(500).json({
      error: 'Failed to test EduAI API key',
      details: error.message
    });
  }
});

/** GET /api/eduai/ai-models – returns the available AI model identifiers from EduAI. */
router.get('/ai-models', authenticateToken, async (req, res) => {
  try {
    const models = await eduaiService.listAIModels();
    res.json(models);
  } catch (error) {
    console.error('EduAI list models error:', error);
    res.status(500).json({
      error: 'Failed to retrieve AI models from EduAI',
      details: error.message
    });
  }
});

/**
 * POST /api/eduai/generate-questions-batch – generates N independent questions via batch orchestration.
 * 
 * ARCHITECTURAL PRINCIPLE:
 * - Each question is generated independently by calling single-question generation N times
 * - No shared context between questions
 * - Each question gets a unique batch_id and generation_id
 * - All questions are persisted with status="draft" (isDraft=true)
 * 
 * This is an infrastructure optimization that preserves per-question generation semantics.
 */
router.post('/generate-questions-batch', authenticateToken, async (req, res) => {
  try {
    const {
      prompt,
      courseCode,
      courseId,
      model,
      apiKeys,
      batchSize,
      difficultyDistribution,
      reasoningDistribution,
      topics
    } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!prompt || !courseCode || !courseId) {
      return res.status(400).json({
        error: 'Prompt, course code, and course ID are required'
      });
    }

    if (!batchSize || !Number.isInteger(parseInt(batchSize)) || parseInt(batchSize) < 1) {
      return res.status(400).json({
        error: 'Batch size must be a positive integer'
      });
    }

    // Call batch generation service
    const result = await generateBatchQuestions({
      prompt,
      courseCode,
      courseId: parseInt(courseId),
      userId,
      batchSize: parseInt(batchSize),
      model: model || 'google:gemini-2.5-flash',
      apiKeys: apiKeys || {},
      difficultyDistribution: difficultyDistribution || { easy: 0, medium: 1, hard: 0 },
      reasoningDistribution: reasoningDistribution || { factual: 33, analytical: 33, application: 34 },
      topics: topics || []
    });

    res.json({
      success: true,
      data: {
        questions: result.questions,
        batchId: result.batchId,
        totalRequested: result.totalRequested,
        totalGenerated: result.totalGenerated,
        errors: result.errors
      }
    });
  } catch (error) {
    console.error('EduAI batch question generation error:', error);
    res.status(500).json({
      error: 'Failed to generate batch questions',
      details: error.message
    });
  }
});

export default router;
