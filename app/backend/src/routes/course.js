import express from 'express';
import { Course, Question_Metadata, Topics } from '../schema/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/course
// @desc    Create a new course
// @access  Private
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { name, courseCode } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Course name is required'
      });
    }

    const courseData = await Course.create({
      userId: req.user.id,
      name: name.trim(),
      code: courseCode || null
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

// @route   GET /api/course
// @desc    Get all courses for the current user
// @access  Private
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { includeStats = false } = req.query;
    
    let includeOptions = [];
    if (includeStats === 'true') {
      includeOptions = [
        {
          model: Question_Metadata,
          as: 'questionMetadata',
          attributes: ['id', 'type', 'description'],
          required: false
        },
        {
          model: Topics,
          as: 'topics',
          attributes: ['id', 'name'],
          required: false
        }
      ];
    }

    const courses = await Course.findAll({
      where: { userId: req.user.id },
      include: includeOptions,
      order: [['createdAt', 'DESC']]
    });

    // Add stats if requested
    if (includeStats === 'true') {
      const coursesWithStats = courses.map(course => ({
        ...course.toJSON(),
        stats: {
          totalQuestions: course.questionMetadata?.length || 0,
          totalTopics: course.topics?.length || 0,
          questionTypes: course.questionMetadata?.reduce((acc, q) => {
            acc[q.type] = (acc[q.type] || 0) + 1;
            return acc;
          }, {}) || {}
        }
      }));
      
      return res.json({
        success: true,
        data: coursesWithStats
      });
    }

    res.json({
      success: true,
      data: courses
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/course/:id
// @desc    Get a specific course
// @access  Private
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { includeDetails = false } = req.query;
    
    let includeOptions = [];
    if (includeDetails === 'true') {
      includeOptions = [
        {
          model: Question_Metadata,
          as: 'questionMetadata',
          attributes: ['id', 'type', 'description', 'questionOrder'],
          include: [
            {
              model: Topics,
              as: 'primaryTopic',
              attributes: ['id', 'name']
            }
          ]
        },
        {
          model: Topics,
          as: 'topics',
          attributes: ['id', 'name']
        }
      ];
    }

    const courseData = await Course.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: includeOptions
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

// @route   PUT /api/course/:id
// @desc    Update a course
// @access  Private
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { name, courseCode } = req.body;

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
      ...(name !== undefined && { name: name?.trim() || courseData.name }),
      ...(courseCode !== undefined && { code: courseCode || null })
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

// @route   DELETE /api/course/:id
// @desc    Delete a course
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

// @route   GET /api/course/:id/topics
// @desc    Get all topics for a specific course
// @access  Private
router.get('/:id/topics', authenticateToken, async (req, res, next) => {
  try {
    // Verify user owns the course
    const course = await Course.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    const topics = await Topics.findAll({
      where: { courseId: req.params.id },
      order: [['createdAt', 'ASC']]
    });

    res.json({
      success: true,
      data: topics
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/course/:id/topics
// @desc    Create a new topic for a course
// @access  Private
router.post('/:id/topics', authenticateToken, async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Topic name is required'
      });
    }

    // Verify user owns the course
    const course = await Course.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    const topic = await Topics.create({
      courseId: req.params.id,
      name: name.trim()
    });

    res.status(201).json({
      success: true,
      message: 'Topic created successfully',
      data: topic
    });
  } catch (error) {
    next(error);
  }
});

export default router;
