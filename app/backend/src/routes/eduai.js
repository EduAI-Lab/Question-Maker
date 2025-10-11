import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import eduaiService from '../services/eduaiService.js';
import { Course } from '../schema/Course.js';

const router = express.Router();

/**
 * @route POST /api/eduai/chat
 * @desc Send a chat message to EduAI with course context
 * @access Private
 */
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

    // Verify user has access to the course
    const course = await Course.findOne({
      where: { 
        code: courseCode,
        userId: userId 
      }
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found or access denied' });
    }

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

/**
 * @route POST /api/eduai/generate-questions
 * @desc Generate questions using EduAI with course context
 * @access Private
 */
router.post('/generate-questions', authenticateToken, async (req, res) => {
  try {
    const { 
      prompt, 
      courseCode, 
      model, 
      apiKeys, 
      numQuestions, 
      difficultyDistribution 
    } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!prompt || !courseCode) {
      return res.status(400).json({ 
        error: 'Prompt and course code are required' 
      });
    }

    // Verify user has access to the course
    const course = await Course.findOne({
      where: { 
        code: courseCode,
        userId: userId 
      }
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found or access denied' });
    }

    // Call EduAI service to generate questions
    const questions = await eduaiService.generateQuestions({
      prompt,
      courseCode,
      model: model || 'google:gemini-2.5-flash',
      apiKeys: apiKeys || {},
      numQuestions: numQuestions || 5,
      difficultyDistribution: difficultyDistribution || { easy: 1, medium: 2, hard: 2 }
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

/**
 * @route GET /api/eduai/models
 * @desc Get available AI models from EduAI
 * @access Private
 */
router.get('/models', authenticateToken, async (req, res) => {
  try {
    const models = await eduaiService.getAvailableModels();
    
    res.json({
      success: true,
      data: models
    });
  } catch (error) {
    console.error('EduAI models error:', error);
    res.status(500).json({ 
      error: 'Failed to get available models',
      details: error.message 
    });
  }
});

/**
 * @route GET /api/eduai/test
 * @desc Test EduAI connection
 * @access Private
 */
router.get('/test', authenticateToken, async (req, res) => {
  try {
    const result = await eduaiService.testConnection();
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        configured: eduaiService.isConfigured()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        configured: eduaiService.isConfigured()
      });
    }
  } catch (error) {
    console.error('EduAI test error:', error);
    res.status(500).json({ 
      error: 'Failed to test EduAI connection',
      details: error.message 
    });
  }
});

/**
 * @route GET /api/eduai/status
 * @desc Get EduAI service status
 * @access Private
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        configured: eduaiService.isConfigured(),
        baseURL: eduaiService.baseURL,
        hasApiKey: !!eduaiService.apiKey
      }
    });
  } catch (error) {
    console.error('EduAI status error:', error);
    res.status(500).json({ 
      error: 'Failed to get EduAI status',
      details: error.message 
    });
  }
});

/**
 * @route GET /api/eduai/test-api-key
 * @desc Test EduAI API key validity
 * @access Private
 */
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

export default router;
