/**
 * Batch question generation service that generates N independent questions
 * by calling single-question generation N times.
 * 
 * ARCHITECTURAL PRINCIPLE:
 * - Each question is generated independently (no shared context)
 * - Single-question generation remains the atomic unit
 * - Batch generation is a thin orchestration layer only
 * - No retries or regeneration logic inside batch mode
 * - Fixed temperature and model parameters across all generations
 */

import crypto from 'crypto';
import eduaiService from './eduaiService.js';
import { createQuestion, createVariant } from './questionService.js';
import { Question_Metadata, Variants } from '../schema/index.js';

/**
 * Generates a batch of N independent questions.
 * 
 * @param {Object} params - Generation parameters
 * @param {string} params.prompt - Base prompt for question generation
 * @param {string} params.courseCode - Course code for EduAI context
 * @param {number} params.courseId - Local course ID for persistence
 * @param {number} params.userId - User ID for ownership validation
 * @param {number} params.batchSize - Number of questions to generate (N)
 * @param {string} params.model - AI model identifier (default: 'google:gemini-2.5-flash')
 * @param {Object} params.apiKeys - Provider API keys
 * @param {Object} params.difficultyDistribution - Difficulty distribution (for single-question generation)
 * @param {Object} params.reasoningDistribution - Reasoning distribution (for single-question generation)
 * @param {Array} params.topics - Array of topic objects with id and name
 * @returns {Promise<Array>} Array of generated question objects with batch_id and generation_id
 */
export const generateBatchQuestions = async (params) => {
  const {
    prompt,
    courseCode,
    courseId,
    userId,
    batchSize,
    model = 'google:gemini-2.5-flash',
    apiKeys = {},
    difficultyDistribution = { easy: 0, medium: 1, hard: 0 },
    reasoningDistribution = { factual: 33, analytical: 33, application: 34 },
    topics = []
  } = params;

  // Validate inputs
  if (!prompt || !prompt.trim()) {
    throw new Error('Prompt is required for batch generation');
  }

  if (!courseCode) {
    throw new Error('Course code is required for batch generation');
  }

  if (!courseId || !Number.isInteger(Number(courseId))) {
    throw new Error('Valid courseId is required for batch generation');
  }

  if (!userId || !Number.isInteger(Number(userId))) {
    throw new Error('Valid userId is required for batch generation');
  }

  const parsedBatchSize = parseInt(batchSize);
  if (!Number.isInteger(parsedBatchSize) || parsedBatchSize < 1 || parsedBatchSize > 100) {
    throw new Error('Batch size must be an integer between 1 and 100');
  }

  // Generate a unique batch ID for this batch session
  const batchId = crypto.randomUUID();

  // Build prompt with topics if provided
  const promptWithTopics = (() => {
    const trimmedPrompt = prompt.trim();
    const sections = [trimmedPrompt];

    if (topics.length > 0) {
      const topicLines = topics.map((topic) => `- [${topic.id}] ${topic.name}`).join('\n');
      sections.push(
        `Course topics:\n${topicLines}\n\nUse these numeric IDs for "primary_topic_id" and "secondary_topic_ids".`
      );
    }

    return sections.filter(Boolean).join('\n\n');
  })();

  // Generate questions independently - each call is isolated
  const generatedQuestions = [];
  const errors = [];

  for (let i = 0; i < parsedBatchSize; i++) {
    // Generate a unique generation ID for this specific question
    const generationId = crypto.randomUUID();

    try {
      // Call single-question generation with numQuestions: 1
      // This ensures each question is generated independently
      const questions = await eduaiService.generateQuestions({
        prompt: promptWithTopics,
        courseCode,
        model,
        apiKeys,
        numQuestions: 1, // CRITICAL: Always generate exactly 1 question per call
        difficultyDistribution,
        reasoningDistribution
      });

      // Validate that we got exactly one question
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error(`Generation ${i + 1} returned no questions`);
      }

      const generated = questions[0];
      if (!generated || !generated.content) {
        throw new Error(`Generation ${i + 1} returned invalid question data`);
      }

      // Persist the question with batch_id and generation_id
      const savedQuestion = await persistBatchQuestion({
        generated,
        batchId,
        generationId,
        courseId,
        userId,
        topics
      });

      generatedQuestions.push({
        ...savedQuestion,
        batch_id: batchId,
        generation_id: generationId
      });
    } catch (error) {
      // Log error but continue with other generations
      // This preserves independence - one failure doesn't stop the batch
      console.error(`Batch generation error for question ${i + 1}/${parsedBatchSize}:`, error);
      errors.push({
        index: i + 1,
        generationId,
        error: error.message || 'Unknown error'
      });
    }
  }

  return {
    questions: generatedQuestions,
    batchId,
    totalRequested: parsedBatchSize,
    totalGenerated: generatedQuestions.length,
    errors: errors.length > 0 ? errors : undefined
  };
};

/**
 * Persists a single generated question to the database with batch metadata.
 * 
 * @param {Object} params - Persistence parameters
 * @param {Object} params.generated - Generated question object from EduAI
 * @param {string} params.batchId - Batch identifier
 * @param {string} params.generationId - Generation identifier
 * @param {number} params.courseId - Course ID
 * @param {number} params.userId - User ID
 * @param {Array} params.topics - Available topics
 * @returns {Promise<Object>} Saved question object
 */
const persistBatchQuestion = async ({ generated, batchId, generationId, courseId, userId, topics }) => {
  // Resolve topic IDs
  const topicIdSet = new Set(topics.map((topic) => topic.id));
  
  const primaryCandidate = Number(generated.primary_topic_id);
  const primaryTopicId = Number.isInteger(primaryCandidate) && topicIdSet.has(primaryCandidate)
    ? primaryCandidate
    : (topics.length > 0 ? topics[0].id : null);

  if (!primaryTopicId) {
    throw new Error('No valid primary topic available for question');
  }

  const resolvedSecondaryTopics = Array.isArray(generated.secondary_topic_ids)
    ? Array.from(
        new Set(
          generated.secondary_topic_ids
            .map((value) => Number(value))
            .filter(
              (value) =>
                Number.isInteger(value) &&
                topicIdSet.has(value) &&
                value !== primaryTopicId
            )
        )
      )
    : [];

  // Infer question type
  const inferredType =
    generated.type === 'SA' || generated.type === 'MCQ' || generated.type === 'LA'
      ? generated.type
      : 'MCQ';

  // Infer difficulty
  const inferredDifficulty =
    generated.difficulty === 'easy' || generated.difficulty === 'hard'
      ? generated.difficulty
      : 'medium';

  // Infer reasoning level
  const inferredReasoningLevel =
    generated.reasoning_level === 'analytical' || generated.reasoning_level === 'application'
      ? generated.reasoning_level
      : 'factual';

  // Generate description
  const resolvedDescription =
    typeof generated.description === 'string' && generated.description.trim().length > 0
      ? generated.description.trim()
      : generated.content.substring(0, 100) + (generated.content.length > 100 ? '...' : '');

  // Resolve answer
  const resolvedAnswer =
    typeof generated.answer === 'string' && generated.answer.trim().length > 0
      ? generated.answer.trim()
      : null;

  // Create question metadata
  const questionMetadata = await createQuestion(userId, {
    description: resolvedDescription,
    courseId,
    primaryTopicId,
    type: inferredType
  });

  // Create variant with batch metadata (batch_id and generation_id are set via createVariant)
  const variant = await createVariant(questionMetadata.id, {
    questionText: generated.content.trim(),
    difficulty: inferredDifficulty,
    reasoningLevel: inferredReasoningLevel,
    answer: resolvedAnswer,
    secondaryTopicsId: resolvedSecondaryTopics.length > 0 ? resolvedSecondaryTopics : undefined,
    isAiGenerated: true,
    isDraft: true, // All batch-generated questions start as drafts
    batchId, // Set batch_id for tracking
    generationId // Set generation_id for tracking
  }, userId);

  // Fetch the complete question with associations
  const savedQuestion = await Question_Metadata.findOne({
    where: { id: questionMetadata.id },
    include: [
      {
        model: Variants,
        as: 'variants',
        where: { id: variant.id }
      }
    ]
  });

  return savedQuestion ? savedQuestion.toJSON() : null;
};

