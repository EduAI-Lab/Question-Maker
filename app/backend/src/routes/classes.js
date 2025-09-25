import express from 'express';
import { Course } from '../schema/Course.js';
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

    const courseData = await Course.create({
      userId: req.user.id,
      name,
      code: courseCode
    });

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: courseData
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
    const courses = await Course.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: courses
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
    const courseData = await Course.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!courseData) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    res.json({
      success: true,
      data: courseData
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

    const courseData = await Course.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!courseData) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    await courseData.update({
      name,
      code: courseCode
    });

    res.json({
      success: true,
      message: 'Course updated successfully',
      data: courseData
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
    const courseData = await Course.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!courseData) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    await courseData.destroy();

    res.json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;

