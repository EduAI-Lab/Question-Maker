import express from 'express';
import { Class } from '../models/Class.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/classes
// @desc    Create a new class
// @access  Private
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { name, subject, courseCode, semester, year, description, department } = req.body;

    if (!name || !subject) {
      return res.status(400).json({
        success: false,
        error: 'Name and subject are required'
      });
    }

    const classData = await Class.create({
      userId: req.user.id,
      name,
      subject,
      courseCode,
      semester,
      year,
      description,
      department
    });

    res.status(201).json({
      success: true,
      message: 'Class created successfully',
      data: classData
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/classes
// @desc    Get all classes for the current user
// @access  Private
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const classes = await Class.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: classes
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/classes/:id
// @desc    Get a specific class
// @access  Private
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const classData = await Class.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!classData) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    res.json({
      success: true,
      data: classData
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/classes/:id
// @desc    Update a class
// @access  Private
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { name, subject, courseCode, semester, year, description, department } = req.body;

    const classData = await Class.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!classData) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    await classData.update({
      name,
      subject,
      courseCode,
      semester,
      year,
      description,
      department
    });

    res.json({
      success: true,
      message: 'Class updated successfully',
      data: classData
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/classes/:id
// @desc    Delete a class
// @access  Private
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const classData = await Class.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!classData) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    await classData.destroy();

    res.json({
      success: true,
      message: 'Class deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;

