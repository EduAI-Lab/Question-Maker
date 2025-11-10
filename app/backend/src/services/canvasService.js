import axios from 'axios';
import { CanvasIntegration, CanvasCourseMapping } from '../schema/index.js';
import { getAssessmentById } from './assessmentService.js';

/**
 * Canvas LMS API Service
 * Supports both real Canvas API integration and test mode for development
 */

// Mock data for test mode
const MOCK_CANVAS_COURSES = [
  { id: 1, name: 'Introduction to Computer Science', course_code: 'COSC 101' },
  { id: 2, name: 'Data Structures and Algorithms', course_code: 'COSC 201' },
  { id: 3, name: 'Machine Architecture', course_code: 'COSC 211' },
  { id: 4, name: 'Computer Programming II', course_code: 'COSC 121' }
];

/**
 * Get or create Canvas integration for a user
 */
export const getCanvasIntegration = async (userId) => {
  try {
    let integration = await CanvasIntegration.findOne({
      where: { userId }
    });

    return integration;
  } catch (error) {
    throw new Error(`Failed to get Canvas integration: ${error.message}`);
  }
};

/**
 * Create or update Canvas integration
 */
export const saveCanvasIntegration = async (userId, { canvasUrl, apiKey, isTestMode = false }) => {
  try {
    const [integration, created] = await CanvasIntegration.findOrCreate({
      where: { userId },
      defaults: {
        userId,
        canvasUrl,
        apiKey, // In production, encrypt this
        isTestMode
      }
    });

    if (!created) {
      await integration.update({
        canvasUrl,
        apiKey,
        isTestMode
      });
    }

    return integration;
  } catch (error) {
    throw new Error(`Failed to save Canvas integration: ${error.message}`);
  }
};

/**
 * Make Canvas API request (with test mode support)
 */
const makeCanvasRequest = async (integration, method, endpoint, data = null) => {
  if (integration.isTestMode) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Return mock responses based on endpoint
    if (endpoint.includes('/courses')) {
      return { data: MOCK_CANVAS_COURSES };
    }
    if (endpoint.includes('/quizzes')) {
      return { data: { id: Math.floor(Math.random() * 1000), title: data?.quiz?.title || 'Test Quiz' } };
    }
    if (endpoint.includes('/questions')) {
      return { data: { id: Math.floor(Math.random() * 1000) } };
    }
    return { data: { success: true } };
  }

  // Real Canvas API request
  const url = `${integration.canvasUrl}/api/v1${endpoint}`;
  const config = {
    method,
    url,
    headers: {
      'Authorization': `Bearer ${integration.apiKey}`,
      'Content-Type': 'application/json'
    }
  };

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return response;
  } catch (error) {
    if (error.response) {
      throw new Error(`Canvas API error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`);
    }
    throw new Error(`Canvas API request failed: ${error.message}`);
  }
};

/**
 * Get user's Canvas courses
 */
export const getCanvasCourses = async (userId) => {
  try {
    const integration = await getCanvasIntegration(userId);
    
    if (!integration) {
      throw new Error('Canvas integration not configured. Please connect your Canvas account first.');
    }

    if (integration.isTestMode) {
      // Return mock courses in test mode
      return MOCK_CANVAS_COURSES;
    }
    
    const response = await makeCanvasRequest(integration, 'GET', '/courses?enrollment_type=teacher&enrollment_role=TeacherEnrollment');
    
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get Canvas courses: ${error.message}`);
  }
};

/**
 * Create a Canvas quiz from an assessment
 */
export const exportAssessmentToCanvas = async (userId, assessmentId, canvasCourseId) => {
  try {
    const integration = await getCanvasIntegration(userId);
    
    if (!integration) {
      throw new Error('Canvas integration not configured. Please connect your Canvas account first.');
    }

    // Get the assessment with all its questions
    const assessment = await getAssessmentById(assessmentId, userId);
    
    if (!assessment) {
      throw new Error('Assessment not found');
    }

    // Get all questions from sections
    const questions = [];
    if (assessment.sections && assessment.sections.length > 0) {
      for (const section of assessment.sections) {
        if (section.sectionVariants && section.sectionVariants.length > 0) {
          for (const sectionVariant of section.sectionVariants) {
            const variant = sectionVariant.variant;
            if (variant) {
              questions.push({
                variant,
                sectionName: section.name,
                displayOrder: sectionVariant.displayOrder
              });
            }
          }
        }
      }
    }

    if (questions.length === 0) {
      throw new Error('Assessment has no questions to export');
    }

    // Create quiz in Canvas
    const quizData = {
      quiz: {
        title: assessment.name,
        description: assessment.description || `Exported from Question Maker - ${assessment.type}`,
        quiz_type: 'assignment',
        published: false, // Don't publish automatically
        show_correct_answers: true,
        allowed_attempts: 1
      }
    };

    const quizResponse = await makeCanvasRequest(
      integration,
      'POST',
      `/courses/${canvasCourseId}/quizzes`,
      quizData
    );

    const quizId = quizResponse.data.id;

    // Create questions in Canvas
    const createdQuestions = [];
    for (let i = 0; i < questions.length; i++) {
      const { variant, sectionName } = questions[i];
      const questionMetadata = variant.questionMetadata;
      
      if (!questionMetadata) continue;

      const canvasQuestion = convertVariantToCanvasQuestion(variant, questionMetadata, i + 1, sectionName);
      
      const questionResponse = await makeCanvasRequest(
        integration,
        'POST',
        `/courses/${canvasCourseId}/quizzes/${quizId}/questions`,
        { question: canvasQuestion }
      );

      createdQuestions.push(questionResponse.data);
    }

    // Save course mapping if it doesn't exist
    const courseMapping = await CanvasCourseMapping.findOne({
      where: {
        userId,
        localCourseId: assessment.courseId
      }
    });

    if (!courseMapping) {
      await CanvasCourseMapping.create({
        userId,
        localCourseId: assessment.courseId,
        canvasCourseId,
        canvasCourseName: integration.isTestMode ? 'Test Course' : undefined
      });
    }

    return {
      quizId,
      quizTitle: quizResponse.data.title,
      questionsCreated: createdQuestions.length,
      canvasUrl: integration.isTestMode 
        ? `[TEST MODE] Quiz would be created at: ${integration.canvasUrl}/courses/${canvasCourseId}/quizzes/${quizId}`
        : `${integration.canvasUrl}/courses/${canvasCourseId}/quizzes/${quizId}`
    };
  } catch (error) {
    throw new Error(`Failed to export assessment to Canvas: ${error.message}`);
  }
};

/**
 * Convert a variant to Canvas question format
 */
const convertVariantToCanvasQuestion = (variant, questionMetadata, position, sectionName) => {
  const questionText = variant.questionText || '';
  const answerText = variant.answer || '';
  const isMCQ = questionMetadata.type === 'MCQ';
  
  const baseQuestion = {
    question_name: `${position}. ${questionMetadata.description || 'Question'}`,
    question_text: questionText,
    points_possible: 1,
    position: position
  };

  if (isMCQ) {
    // Parse MCQ options from question text and determine correct answer
    const options = parseMCQOptions(questionText, answerText);
    
    return {
      ...baseQuestion,
      question_type: 'multiple_choice_question',
      answers: options.map((option) => ({
        answer_text: option.text,
        answer_weight: option.isCorrect ? 100 : 0,
        answer_comment: option.isCorrect ? 'Correct!' : ''
      }))
    };
  } else {
    // Short answer question
    return {
      ...baseQuestion,
      question_type: 'short_answer_question',
      answers: [
        {
          answer_text: answerText || 'Sample answer',
          answer_weight: 100
        }
      ]
    };
  }
};

/**
 * Parse MCQ options from question text and determine correct answer
 * Format: "Question text\nA) Option A\nB) Option B\nC) Option C\nD) Option D"
 * Answer format: "B) Option B" or just "B"
 */
const parseMCQOptions = (questionText, answerText) => {
  const lines = questionText.split('\n');
  const options = [];
  
  // Extract the correct answer letter from answer text
  let correctAnswerLetter = null;
  if (answerText) {
    const answerMatch = answerText.match(/^([A-D])\)?/);
    if (answerMatch) {
      correctAnswerLetter = answerMatch[1];
    }
  }
  
  // Parse options from question text
  for (const line of lines) {
    const match = line.match(/^([A-D])\)\s*(.+)$/);
    if (match) {
      const letter = match[1];
      const text = match[2].trim();
      options.push({
        text,
        letter,
        isCorrect: letter === correctAnswerLetter
      });
    }
  }

  // If no options found, create default options
  if (options.length === 0) {
    return [
      { text: 'Option A', isCorrect: correctAnswerLetter === 'A' },
      { text: 'Option B', isCorrect: correctAnswerLetter === 'B' || !correctAnswerLetter },
      { text: 'Option C', isCorrect: correctAnswerLetter === 'C' },
      { text: 'Option D', isCorrect: correctAnswerLetter === 'D' }
    ];
  }

  // Sort options by letter (A, B, C, D)
  options.sort((a, b) => a.letter.localeCompare(b.letter));

  return options;
};

/**
 * Get Canvas course mapping for a local course
 */
export const getCanvasCourseMapping = async (userId, localCourseId) => {
  try {
    const mapping = await CanvasCourseMapping.findOne({
      where: {
        userId,
        localCourseId
      }
    });

    return mapping;
  } catch (error) {
    throw new Error(`Failed to get Canvas course mapping: ${error.message}`);
  }
};

