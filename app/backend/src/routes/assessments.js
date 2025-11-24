import express from 'express';
import { 
  createAssessment, 
  getAssessmentsByUser, 
  getAssessmentById, 
  updateAssessment, 
  deleteAssessment,
  addQuestionToAssessment,
  removeQuestionFromAssessment,
  getQuestionsInAssessment
} from '../services/assessmentService.js';
import {
  getSectionsForAssessment,
  createAssessmentSection,
  updateAssessmentSection,
  deleteAssessmentSection,
  addVariantToSection,
  removeVariantFromSection,
  updateVariantOrderInSection,
  removeQuestionFromAllSections
} from '../services/assessmentSectionService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/assessments
// @desc    Create a new assessment
// @access  Private
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { type, name, semester, description, courseId, blueprintConfig } = req.body;

    if (!type || !name || !semester || !courseId) {
      return res.status(400).json({
        success: false,
        error: 'Type, name, semester, and courseId are required'
      });
    }

    const assessment = await createAssessment(req.user.id, {
      type,
      name,
      semester,
      description,
      courseId,
      blueprintConfig
    });

    res.status(201).json({
      success: true,
      message: 'Assessment created successfully',
      data: assessment
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/assessments
// @desc    Get all assessments for the current user
// @access  Private
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { limit, offset, courseId } = req.query;

    const assessments = await getAssessmentsByUser(req.user.id, {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      courseId: courseId ? Number(courseId) : undefined
    });

    res.json({
      success: true,
      data: assessments
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/assessments/:id
// @desc    Get a specific assessment
// @access  Private
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const assessment = await getAssessmentById(req.params.id, req.user.id);

    res.json({
      success: true,
      data: assessment
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/assessments/:id
// @desc    Update an assessment
// @access  Private
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { type, name, semester, description, courseId, blueprintConfig } = req.body;

    const assessment = await updateAssessment(req.params.id, {
      type,
      name,
      semester,
      description,
      courseId,
      blueprintConfig
    }, req.user.id);

    res.json({
      success: true,
      message: 'Assessment updated successfully',
      data: assessment
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/assessments/:id
// @desc    Delete an assessment
// @access  Private
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    await deleteAssessment(req.params.id, req.user.id);

    res.json({
      success: true,
      message: 'Assessment deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/assessments/:id/questions
// @desc    Add a question to an assessment
// @access  Private
router.post('/:id/questions', authenticateToken, async (req, res, next) => {
  try {
    const { questionId, orderNumber } = req.body;

    if (!questionId || orderNumber === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Question ID and order number are required'
      });
    }

    const question = await addQuestionToAssessment(
      req.params.id, 
      questionId, 
      orderNumber, 
      req.user.id
    );

    res.json({
      success: true,
      message: 'Question added to assessment successfully',
      data: question
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/assessments/:id/questions/:questionId
// @desc    Remove a question from an assessment
// @access  Private
router.delete('/:id/questions/:questionId', authenticateToken, async (req, res, next) => {
  try {
    const question = await removeQuestionFromAssessment(
      req.params.id, 
      req.params.questionId, 
      req.user.id
    );

    res.json({
      success: true,
      message: 'Question removed from assessment successfully',
      data: question
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/assessments/:id/questions
// @desc    Get all questions in an assessment
// @access  Private
router.get('/:id/questions', authenticateToken, async (req, res, next) => {
  try {
    const questions = await getQuestionsInAssessment(req.params.id, req.user.id);

    res.json({
      success: true,
      data: questions
    });
  } catch (error) {
    next(error);
  }
});

// Section routes
router.get('/:id/sections', authenticateToken, async (req, res, next) => {
  try {
    const sections = await getSectionsForAssessment(req.params.id, req.user.id);
    res.json({ success: true, data: sections });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/sections', authenticateToken, async (req, res, next) => {
  try {
    const section = await createAssessmentSection(req.params.id, req.user.id, req.body);
    res.status(201).json({
      success: true,
      message: 'Section created successfully',
      data: section
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:assessmentId/sections/:sectionId', authenticateToken, async (req, res, next) => {
  try {
    const section = await updateAssessmentSection(req.params.sectionId, req.user.id, req.body);
    res.json({
      success: true,
      message: 'Section updated successfully',
      data: section
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:assessmentId/sections/:sectionId', authenticateToken, async (req, res, next) => {
  try {
    await deleteAssessmentSection(req.params.sectionId, req.user.id);
    res.json({
      success: true,
      message: 'Section deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:assessmentId/sections/:sectionId/variants', authenticateToken, async (req, res, next) => {
  try {
    const { variantId, displayOrder, metadata } = req.body;

    if (!variantId) {
      return res.status(400).json({
        success: false,
        error: 'variantId is required'
      });
    }

    const link = await addVariantToSection(
      req.params.sectionId,
      req.user.id,
      Number(variantId),
      { displayOrder, metadata }
    );

    res.status(201).json({
      success: true,
      message: 'Variant added to section successfully',
      data: link
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:assessmentId/sections/:sectionId/variants/:variantId/order', authenticateToken, async (req, res, next) => {
  try {
    const { displayOrder } = req.body;

    if (displayOrder === undefined) {
      return res.status(400).json({
        success: false,
        error: 'displayOrder is required'
      });
    }

    const link = await updateVariantOrderInSection(
      req.params.sectionId,
      req.user.id,
      Number(req.params.variantId),
      Number(displayOrder)
    );

    res.json({
      success: true,
      message: 'Variant order updated successfully',
      data: link
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:assessmentId/sections/:sectionId/variants/:variantId', authenticateToken, async (req, res, next) => {
  try {
    await removeVariantFromSection(
      req.params.sectionId,
      req.user.id,
      Number(req.params.variantId)
    );

    res.json({
      success: true,
      message: 'Variant removed from section successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Remove question from all sections across all assessments
router.delete('/questions/:questionId/remove-from-all-sections', authenticateToken, async (req, res, next) => {
  try {
    const result = await removeQuestionFromAllSections(
      Number(req.params.questionId),
      req.user.id
    );

    res.json({
      success: true,
      message: 'Question removed from all sections successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

export default router;
