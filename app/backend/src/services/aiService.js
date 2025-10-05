import axios from 'axios';
import { config } from '../config/settings.js';
import { Question_Metadata, Variants } from '../schema/index.js';

const AI_PROVIDERS = {
  GROQ: 'groq',
  OPENAI: 'openai',
  DEEPSEEK: 'deepseek'
};

const callGroqAPI = async (prompt, params) => {
  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a question generation assistant. Generate exactly ${params.numQuestions} high-quality questions with the following distribution:
          - Easy: ${params.difficultyDistribution.easy} questions
          - Medium: ${params.difficultyDistribution.medium} questions
          - Hard: ${params.difficultyDistribution.hard} questions

          For each question:
          1. Classify its difficulty (easy/medium/hard)
          2. Classify its Bloom's Taxonomy level (remember/understand/apply/analyze/evaluate/create)
          3. Format each question as a JSON object
          
          IMPORTANT: Your response must be ONLY a valid JSON array of question objects. Do not include any other text.
          Each object must have this exact format:
          {
            "content": "The question text",
            "difficulty": "easy/medium/hard",
            "bloom_level": "remember/understand/apply/analyze/evaluate/create"
          }`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      top_p: 0.9,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${config.groqApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    throw new Error(`Groq API error: ${error.message}`);
  }
};

const callOpenAIAPI = async (prompt, params) => {
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: `Generate exactly ${params.numQuestions} high-quality questions with the following distribution:
          - Easy: ${params.difficultyDistribution.easy} questions
          - Medium: ${params.difficultyDistribution.medium} questions
          - Hard: ${params.difficultyDistribution.hard} questions

          For each question:
          1. Classify its difficulty (easy/medium/hard)
          2. Classify its Bloom's Taxonomy level (remember/understand/apply/analyze/evaluate/create)
          3. Format each question as a JSON object:
          {
            "content": "The question text",
            "difficulty": "easy/medium/hard",
            "bloom_level": "remember/understand/apply/analyze/evaluate/create"
          }

          IMPORTANT: Your response must be ONLY a valid JSON array of question objects. Do not include any other text.

          Topic to generate questions about: ${prompt}`
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    }, {
      headers: {
        'Authorization': `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    throw new Error(`OpenAI API error: ${error.message}`);
  }
};

const callDeepSeekAPI = async (prompt, params) => {
  try {
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-coder',
      messages: [
        {
          role: 'user',
          content: `Generate exactly ${params.numQuestions} high-quality questions with the following distribution:
          - Easy: ${params.difficultyDistribution.easy} questions
          - Medium: ${params.difficultyDistribution.medium} questions
          - Hard: ${params.difficultyDistribution.hard} questions

          Each question MUST be formatted as a JSON object with these EXACT fields:
          {
            "content": "The complete question text here",
            "difficulty": "easy/medium/hard",
            "bloom_level": "remember/understand/apply/analyze/evaluate/create"
          }

          Your response MUST be a valid JSON array containing EXACTLY ${params.numQuestions} question objects.
          Do not include any text outside the JSON array.

          Topic to generate questions about: ${prompt}`
        }
      ],
      temperature: 0.7,
      max_tokens: 4000,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${config.deepseekApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    throw new Error(`DeepSeek API error: ${error.message}`);
  }
};

export const generateQuestions = async (prompt, provider, params) => {
  try {
    let response;
    
    switch (provider) {
      case AI_PROVIDERS.GROQ:
        response = await callGroqAPI(prompt, params);
        break;
      case AI_PROVIDERS.OPENAI:
        response = await callOpenAIAPI(prompt, params);
        break;
      case AI_PROVIDERS.DEEPSEEK:
        response = await callDeepSeekAPI(prompt, params);
        break;
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }

    // Parse and validate response
    try {
      const questions = JSON.parse(response);
      if (!Array.isArray(questions)) {
        throw new Error('Response is not an array');
      }
      
      // Validate each question
      const validQuestions = questions.filter(q => 
        q.content && 
        q.difficulty && 
        q.bloom_level &&
        ['easy', 'medium', 'hard'].includes(q.difficulty) &&
        ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'].includes(q.bloom_level)
      );

      if (validQuestions.length === 0) {
        throw new Error('No valid questions found in response');
      }

      return validQuestions;
    } catch (parseError) {
      // If parsing fails, return a single question with the response text
      return [{
        content: response,
        difficulty: 'medium',
        bloom_level: 'understand'
      }];
    }
  } catch (error) {
    throw error;
  }
};

export const generateAndSaveQuestions = async (prompt, provider, params, userId, classId, primaryTopicId = 1) => {
  try {
    // Generate questions using AI
    const generatedQuestions = await generateQuestions(prompt, provider, params);
    
    // Create Question_Metadata records
    const questionMetadata = await Question_Metadata.bulkCreate(
      generatedQuestions.map(q => ({
        courseId: classId,
        primaryTopicId: primaryTopicId,
        type: 'MCQ', // Default type
        description: q.content,
        questionOrder: {}
      }))
    );

    // Create Variants for each question
    const variants = [];
    for (let i = 0; i < questionMetadata.length; i++) {
      const questionMeta = questionMetadata[i];
      const generatedQ = generatedQuestions[i];
      
      const variant = await Variants.create({
        questionMetadataId: questionMeta.id,
        questionText: generatedQ.content,
        difficulty: generatedQ.difficulty,
        answer: null, // AI doesn't generate answers yet
        assessmentId: null,
        secondaryTopicsId: [],
        referenceId: null
      });
      
      variants.push(variant);
    }

    return {
      questions: questionMetadata,
      variants: variants,
      generatedCount: generatedQuestions.length
    };
  } catch (error) {
    throw error;
  }
};

export { AI_PROVIDERS };

