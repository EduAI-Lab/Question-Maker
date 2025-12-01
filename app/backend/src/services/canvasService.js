import axios from 'axios';
import { CanvasIntegration, CanvasCourseMapping, Question_Metadata, Variants, AssessmentSections, SectionVariants, Course } from '../schema/index.js';
import { getAssessmentById, createAssessment } from './assessmentService.js';
import { createQuestion } from './questionService.js';
import { createAssessmentSection } from './assessmentSectionService.js';

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
    if (endpoint.includes('/courses') && method === 'GET' && !endpoint.includes('/quizzes')) {
      return { data: MOCK_CANVAS_COURSES };
    }
    if (endpoint.includes('/quizzes') && method === 'POST') {
      return { data: { id: Math.floor(Math.random() * 1000), title: data?.quiz?.title || 'Test Quiz' } };
    }
    if (endpoint.includes('/quizzes') && method === 'GET' && !endpoint.includes('/questions')) {
      // Mock quizzes list
      return { data: [
        { id: 1, title: 'Test Quiz 1', quiz_type: 'assignment', published: false },
        { id: 2, title: 'Test Quiz 2', quiz_type: 'assignment', published: true }
      ] };
    }
    if (endpoint.includes('/questions') && method === 'POST') {
      return { data: { id: Math.floor(Math.random() * 1000) } };
    }
    if (endpoint.includes('/questions') && method === 'GET') {
      // Mock questions
      return { data: [
        {
          id: 1,
          question_name: '1. Test Question',
          question_text: 'What is 2+2?\nA) 3\nB) 4\nC) 5\nD) 6',
          question_type: 'multiple_choice_question',
          position: 1,
          answers: [
            { id: 1, answer_text: '3', answer_weight: 0 },
            { id: 2, answer_text: '4', answer_weight: 100 },
            { id: 3, answer_text: '5', answer_weight: 0 },
            { id: 4, answer_text: '6', answer_weight: 0 }
          ]
        }
      ] };
    }
    if (endpoint.includes('/quizzes') && method === 'GET' && endpoint.match(/\/quizzes\/\d+$/)) {
      // Single quiz details
      const quizId = endpoint.match(/\/quizzes\/(\d+)$/)?.[1];
      return { data: { id: parseInt(quizId), title: 'Test Quiz', quiz_type: 'assignment', published: false } };
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
  const isLongAnswer = questionMetadata.type === 'LA';
  
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
    // Long/short answer question
    return {
      ...baseQuestion,
      question_type: isLongAnswer ? 'essay_question' : 'short_answer_question',
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

/**
 * Get quizzes from a Canvas course
 */
export const getCanvasQuizzes = async (userId, canvasCourseId) => {
  try {
    const integration = await getCanvasIntegration(userId);
    
    if (!integration) {
      throw new Error('Canvas integration not configured. Please connect your Canvas account first.');
    }

    const response = await makeCanvasRequest(
      integration,
      'GET',
      `/courses/${canvasCourseId}/quizzes`
    );

    // Filter to only return assignment-type quizzes (what we export)
    const quizzes = Array.isArray(response.data) ? response.data : [response.data];
    return quizzes.filter(quiz => quiz.quiz_type === 'assignment' || quiz.quiz_type === 'graded_survey');
  } catch (error) {
    throw new Error(`Failed to get Canvas quizzes: ${error.message}`);
  }
};

/**
 * Get questions from a Canvas quiz
 */
export const getCanvasQuizQuestions = async (userId, canvasCourseId, quizId) => {
  try {
    const integration = await getCanvasIntegration(userId);
    
    if (!integration) {
      throw new Error('Canvas integration not configured. Please connect your Canvas account first.');
    }

    const response = await makeCanvasRequest(
      integration,
      'GET',
      `/courses/${canvasCourseId}/quizzes/${quizId}/questions`
    );

    return Array.isArray(response.data) ? response.data : [response.data];
  } catch (error) {
    throw new Error(`Failed to get Canvas quiz questions: ${error.message}`);
  }
};

/**
 * Strip HTML tags from text while preserving line breaks
 */
const stripHtmlTags = (html) => {
  if (!html || typeof html !== 'string') return '';
  
  let text = html;
  
  // Replace block-level elements with line breaks
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n');
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&[#\w]+;/g, '');
  
  // Normalize whitespace: collapse multiple spaces, preserve single newlines
  text = text
    .replace(/[ \t]+/g, ' ') // Collapse spaces and tabs
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .replace(/[ \t]*\n[ \t]*/g, '\n') // Remove spaces around newlines
    .trim();
  
  return text;
};

/**
 * Convert Canvas question to variant format
 * This is the reverse of convertVariantToCanvasQuestion
 * Throws error if question type is not supported
 */
const convertCanvasQuestionToVariant = (canvasQuestion) => {
  const questionType = canvasQuestion.question_type;
  const questionTextRaw = canvasQuestion.question_text || '';
  const questionName = canvasQuestion.question_name || '';
  
  // Strip HTML tags from question text
  const questionText = stripHtmlTags(questionTextRaw);
  
  let localType = 'SA'; // Default to short answer
  let processedQuestionText = questionText;
  let answer = null;

  if (questionType === 'multiple_choice_question' || questionType === 'true_false_question') {
    localType = 'MCQ';
    
    // Reconstruct question text with options
    const answers = canvasQuestion.answers || [];
    if (answers.length > 0) {
      // Find correct answer
      const correctAnswer = answers.find(a => a.answer_weight === 100 || a.answer_weight > 0);
      
      // Build options text
      const options = [];
      let correctLetter = null;
      
      if (questionType === 'true_false_question') {
        // True/False questions
        options.push('A) True');
        options.push('B) False');
        if (correctAnswer) {
          correctLetter = correctAnswer.answer_text === 'True' ? 'A' : 'B';
        }
      } else {
        // Multiple choice - use answer positions to determine letters
        const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        answers.forEach((ans, index) => {
          const letter = letters[index];
          // Strip HTML from answer text
          const answerText = stripHtmlTags(ans.answer_text || '');
          options.push(`${letter}) ${answerText}`);
          if (ans.answer_weight === 100 || ans.answer_weight > 0) {
            correctLetter = letter;
          }
        });
      }
      
      // If question text doesn't already contain options, add them
      if (!questionText.match(/^[A-H]\)/m)) {
        processedQuestionText = questionText.trim();
        if (processedQuestionText && !processedQuestionText.endsWith('\n')) {
          processedQuestionText += '\n';
        }
        processedQuestionText += options.join('\n');
      }
      
      // Set answer
      if (correctLetter) {
        answer = correctLetter;
      } else if (correctAnswer) {
        answer = correctAnswer.answer_text;
      }
    }
  } else if (questionType === 'essay_question') {
    localType = 'LA';
    // Essay questions - extract answer if available
    const answers = canvasQuestion.answers || [];
    if (answers.length > 0 && answers[0].answer_text) {
      answer = stripHtmlTags(answers[0].answer_text);
    }
  } else if (questionType === 'short_answer_question' || questionType === 'fill_in_multiple_blanks_question') {
    localType = 'SA';
    // Short answer - extract answer
    const answers = canvasQuestion.answers || [];
    if (answers.length > 0 && answers[0].answer_text) {
      answer = stripHtmlTags(answers[0].answer_text);
    }
  } else {
    // Unsupported question type
    throw new Error(`Unsupported question type: ${questionType}`);
  }

  // Extract description from question name (remove position number)
  const descriptionMatch = questionName.match(/^\d+\.\s*(.+)$/);
  const description = descriptionMatch ? descriptionMatch[1] : (questionName || 'Imported Question');

  return {
    questionText: processedQuestionText,
    answer: answer,
    type: localType,
    description: description,
    position: canvasQuestion.position || 0
  };
};

/**
 * Import a Canvas quiz as an assessment
 */
export const importQuizFromCanvas = async (userId, canvasCourseId, quizId, localCourseId, options = {}) => {
  try {
    const integration = await getCanvasIntegration(userId);
    
    if (!integration) {
      throw new Error('Canvas integration not configured. Please connect your Canvas account first.');
    }

    // Verify local course exists and belongs to user
    const course = await Course.findOne({
      where: { id: localCourseId, userId },
      attributes: ['id', 'name']
    });

    if (!course) {
      throw new Error('Local course not found');
    }

    // Get quiz details
    const quizResponse = await makeCanvasRequest(
      integration,
      'GET',
      `/courses/${canvasCourseId}/quizzes/${quizId}`
    );
    const quiz = quizResponse.data;

    // Get quiz questions
    const canvasQuestions = await getCanvasQuizQuestions(userId, canvasCourseId, quizId);

    if (canvasQuestions.length === 0) {
      throw new Error('Quiz has no questions to import');
    }

    // Determine assessment type from options or default
    const assessmentType = options.assessmentType || 'Quiz';
    const assessmentName = options.assessmentName || quiz.title || 'Imported Quiz';
    const semester = options.semester || new Date().getFullYear().toString();

    // Create assessment
    const assessment = await createAssessment(userId, {
      type: assessmentType,
      name: assessmentName,
      semester: semester,
      courseId: localCourseId,
      description: quiz.description || `Imported from Canvas: ${quiz.title}`
    });

    // Create a default section for all questions
    const section = await createAssessmentSection(assessment.id, userId, {
      name: 'Imported Questions',
      description: 'Questions imported from Canvas',
      position: 0
    });

    // Convert and import questions with graceful error handling
    const importedQuestions = [];
    const skippedQuestions = [];
    const primaryTopicId = options.primaryTopicId || null;

    if (!primaryTopicId) {
      throw new Error('Primary topic ID is required for importing questions. Please select a topic.');
    }

    for (let i = 0; i < canvasQuestions.length; i++) {
      const canvasQuestion = canvasQuestions[i];
      
      try {
        // Try to convert the question - this will throw if unsupported
        const converted = convertCanvasQuestionToVariant(canvasQuestion);

        // Create question metadata
        const questionMetadata = await Question_Metadata.create({
          courseId: localCourseId,
          primaryTopicId: primaryTopicId,
          type: converted.type,
          description: converted.description,
          questionOrder: {}
        });

        // Create variant
        const variant = await Variants.create({
          questionMetadataId: questionMetadata.id,
          questionText: converted.questionText,
          difficulty: 'medium', // Default difficulty
          answer: converted.answer,
          assessmentId: assessment.id,
          secondaryTopicsId: [],
          isAiGenerated: false,
          isDraft: true // Mark as draft for review
        });

        // Link variant to section
        await SectionVariants.create({
          sectionId: section.id,
          variantId: variant.id,
          displayOrder: converted.position || i
        });

        importedQuestions.push({
          questionMetadataId: questionMetadata.id,
          variantId: variant.id
        });
      } catch (error) {
        // If conversion or creation fails, skip this question but continue
        const questionName = canvasQuestion.question_name || `Question ${i + 1}`;
        const questionType = canvasQuestion.question_type || 'unknown';
        skippedQuestions.push({
          position: canvasQuestion.position || i + 1,
          name: questionName,
          type: questionType,
          reason: error.message || 'Unknown error'
        });
        // Continue to next question
        continue;
      }
    }

    // If no questions were imported at all, throw an error
    if (importedQuestions.length === 0) {
      throw new Error('No questions could be imported. All question types may be unsupported.');
    }

    // Save course mapping if it doesn't exist
    const courseMapping = await CanvasCourseMapping.findOne({
      where: {
        userId,
        localCourseId: localCourseId
      }
    });

    if (!courseMapping) {
      await CanvasCourseMapping.create({
        userId,
        localCourseId: localCourseId,
        canvasCourseId: canvasCourseId,
        canvasCourseName: integration.isTestMode ? 'Test Course' : undefined
      });
    }

    return {
      assessmentId: assessment.id,
      assessmentName: assessment.name,
      questionsImported: importedQuestions.length,
      questionsSkipped: skippedQuestions.length,
      skippedQuestions: skippedQuestions,
      sectionId: section.id
    };
  } catch (error) {
    throw new Error(`Failed to import quiz from Canvas: ${error.message}`);
  }
};
