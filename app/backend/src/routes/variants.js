import express from 'express';
import {
  createVariant,
  updateVariant,
  deleteVariant,
  getVariantsByQuestion
} from '../services/questionService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

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

    const variant = await createVariant(
      req.params.id,
      {
        questionText: questionText.trim(),
        difficulty,
        assessmentId,
        secondaryTopicsId,
        answer,
        referenceId
      },
      req.user.id
    );

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

    const variant = await updateVariant(
      req.params.variantId,
      {
        questionText,
        difficulty,
        assessmentId,
        secondaryTopicsId,
        answer,
        referenceId
      },
      req.user.id
    );

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
