import axios from 'axios';
import { config } from '../config/settings.js';

const AI_PROVIDERS = {
  GROQ: 'groq',
  OPENAI: 'openai',
  DEEPSEEK: 'deepseek'
};

const MAX_OCR_CHUNK_LENGTH = 4000;

const normalizeOcrText = (text = '') => {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[\u00a0\t]+/g, ' ')
    .replace(/-\n/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const splitOcrTextIntoChunks = (text, maxLength = MAX_OCR_CHUNK_LENGTH) => {
  if (!text) return [];

  const segments = text.split(/(?=\b(?:Question|Problem|Exercise|Task|Section|Part)\b)/gi);
  const chunks = [];
  let current = '';

  const pushCurrent = () => {
    if (current.trim()) {
      chunks.push(current.trim());
      current = '';
    }
  };

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    if (!current) {
      current = trimmed;
      continue;
    }

    if ((current + '\n' + trimmed).length > maxLength) {
      pushCurrent();
      current = trimmed;
    } else {
      current = `${current}\n${trimmed}`;
    }
  }

  pushCurrent();

  if (chunks.length === 0) {
    const safeText = text.slice(0, maxLength);
    return safeText ? [safeText] : [];
  }

  return chunks;
};

const extractJsonArray = (raw) => {
  if (!raw) return [];

  const firstBracket = raw.indexOf('[');
  const lastBracket = raw.lastIndexOf(']');

  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const jsonSlice = raw.slice(firstBracket, lastBracket + 1);
    try {
      const parsed = JSON.parse(jsonSlice);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // fall through
    }
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.questions)) return parsed.questions;
  } catch {
    // noop
  }

  return [];
};

const callOpenAIChat = async ({ messages, temperature = 0.7, maxTokens = 2000, model = 'gpt-3.5-turbo' }) => {
  if (!config.openaiApiKey) {
    throw new Error('OpenAI API key is not configured.');
  }

  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model,
    messages,
    temperature,
    max_tokens: maxTokens
  }, {
    headers: {
      'Authorization': `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data.choices[0].message.content;
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
    const content = await callOpenAIChat({
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
      maxTokens: 4000
    });

    return content;
  } catch (error) {
    throw new Error(`OpenAI API error: ${error.message}`);
  }
};

const extractQuestionsWithOpenAI = async (text) => {
  const cleaned = normalizeOcrText(text);
  const chunks = splitOcrTextIntoChunks(cleaned);

  const aggregated = [];
  const seen = new Set();

  for (const chunk of chunks) {
    try {
      const prompt = `You will be given OCR text from an assignment or worksheet. Extract each distinct question (including any lettered subparts that belong to the question) and any mandatory instructions that must accompany it.

Requirements:
- Return ONLY a JSON array. Each element must have the shape {"question": string, "instructions": string}.
- The "question" field must contain the self-contained question text.
- The "instructions" field should contain short preparatory notes (e.g. "Show all work", "Use traceroute") or be an empty string if none.
- Keep numbering that exists in the text (e.g. "1.", "Question 2") inside the question field.
- Do not fabricate content; only use what is present in the excerpt.

OCR excerpt:
"""${chunk}"""`;

      const content = await callOpenAIChat({
        messages: [
          {
            role: 'system',
            content: 'You are a precise assistant that extracts questions from study materials and returns strict JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        maxTokens: 1500
      });

      const parsed = extractJsonArray(content);

      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;
        const questionText = (item.question || item.content || '').toString().trim();
        if (!questionText) continue;

        const instructions = (item.instructions || item.instruction || '').toString().trim();
        const dedupeKey = questionText.toLowerCase();

        if (!seen.has(dedupeKey)) {
          aggregated.push({
            question: questionText,
            instructions
          });
          seen.add(dedupeKey);
        }
      }
    } catch (error) {
      // Skip the chunk if the API call fails; continue with others
      throw new Error(`Failed to extract questions from text chunk: ${error.message}`);
    }
  }

  if (aggregated.length === 0) {
    throw new Error('No questions could be extracted from the provided text.');
  }

  return aggregated;
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

export { AI_PROVIDERS };

export const extractQuestionsFromText = async (text, provider = AI_PROVIDERS.OPENAI) => {
  if (!text || !text.trim()) {
    throw new Error('No text provided for extraction');
  }

  switch (provider) {
    case AI_PROVIDERS.OPENAI:
      return extractQuestionsWithOpenAI(text);
    case AI_PROVIDERS.GROQ:
    case AI_PROVIDERS.DEEPSEEK:
      // Fallback to OpenAI for now until bespoke prompts are created for other providers
      return extractQuestionsWithOpenAI(text);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
};
