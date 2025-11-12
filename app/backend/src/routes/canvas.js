import express from 'express';
import {
  getCanvasIntegration,
  saveCanvasIntegration,
  getCanvasCourses,
  exportAssessmentToCanvas,
  getCanvasCourseMapping
} from '../services/canvasService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/canvas/integration
 * @desc    Get user's Canvas integration status
 * @access  Private
 */
router.get('/integration', authenticateToken, async (req, res, next) => {
  try {
    const integration = await getCanvasIntegration(req.user.id);

    if (!integration) {
      return res.json({
        success: true,
        data: null,
        message: 'Canvas integration not configured'
      });
    }

    // Don't send API key in response
    res.json({
      success: true,
      data: {
        canvasUrl: integration.canvasUrl,
        isTestMode: integration.isTestMode,
        isConnected: true
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/canvas/connect
 * @desc    Connect or update Canvas integration
 * @access  Private
 */
router.post('/connect', authenticateToken, async (req, res, next) => {
  try {
    const { canvasUrl, apiKey, isTestMode } = req.body;

    if (!canvasUrl) {
      return res.status(400).json({
        success: false,
        error: 'Canvas URL is required'
      });
    }

    // In test mode, API key is optional
    if (!isTestMode && !apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key is required (unless using test mode)'
      });
    }

    // Validate URL format
    try {
      new URL(canvasUrl);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Canvas URL format'
      });
    }

    const integration = await saveCanvasIntegration(req.user.id, {
      canvasUrl,
      apiKey: apiKey || 'test-key', // Use placeholder in test mode
      isTestMode: isTestMode || false
    });

    res.json({
      success: true,
      message: isTestMode 
        ? 'Canvas test mode enabled. You can test exports without a real Canvas account.'
        : 'Canvas integration connected successfully',
      data: {
        canvasUrl: integration.canvasUrl,
        isTestMode: integration.isTestMode
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/canvas/disconnect
 * @desc    Disconnect Canvas integration
 * @access  Private
 */
router.delete('/disconnect', authenticateToken, async (req, res, next) => {
  try {
    const integration = await getCanvasIntegration(req.user.id);

    if (integration) {
      await integration.destroy();
    }

    res.json({
      success: true,
      message: 'Canvas integration disconnected'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/canvas/courses
 * @desc    Get user's Canvas courses
 * @access  Private
 */
router.get('/courses', authenticateToken, async (req, res, next) => {
  try {
    const courses = await getCanvasCourses(req.user.id);

    res.json({
      success: true,
      data: courses
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/canvas/export/:assessmentId
 * @desc    Export assessment to Canvas
 * @access  Private
 */
router.post('/export/:assessmentId', authenticateToken, async (req, res, next) => {
  try {
    const { assessmentId } = req.params;
    const { canvasCourseId } = req.body;

    if (!canvasCourseId) {
      return res.status(400).json({
        success: false,
        error: 'Canvas course ID is required'
      });
    }

    const result = await exportAssessmentToCanvas(
      req.user.id,
      assessmentId,
      canvasCourseId
    );

    res.json({
      success: true,
      message: 'Assessment exported to Canvas successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/canvas/mapping/:courseId
 * @desc    Get Canvas course mapping for a local course
 * @access  Private
 */
router.get('/mapping/:courseId', authenticateToken, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const mapping = await getCanvasCourseMapping(req.user.id, courseId);

    res.json({
      success: true,
      data: mapping
    });
  } catch (error) {
    next(error);
  }
});

export default router;

