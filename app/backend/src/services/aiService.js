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

const normalizeExtractText = (text) => {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    // collapse runs of more than two newlines to a double newline
    .replace(/\n{3,}/g, '\n\n')
    // collapse excessive spaces while preserving newlines
    .replace(/[ ]{2,}/g, ' ')
    .trim();
};

const chunkText = (text, chunkSize = 6000) => {
  if (!text) return [];
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
};

const callOpenAIForExtraction = async (textChunk) => {
  if (!config.openaiApiKey) {
    throw new Error('OpenAI API key is not configured. Please add it to the .env file.');
  }

  const systemPrompt = `You are an assistant that extracts study questions from source material.
Return a JSON array (no additional text). Each object must follow this shape exactly:
{
  "summary": "Short descriptive sentence (<=12 words, no trailing question mark)",
  "question": "Full question text exactly as presented to students. Include all sub-parts, numbering, and instructions. Use \\n to represent line breaks.",
  "instructions": "Optional teaching notes or context (string, omit or set to null if not available)",
  "difficulty": "easy | medium | hard",
  "answer": "Optional short answer text or null",
  "type": "MCQ | SA"
}

Guidelines:
- Treat each contiguous question block as a single entry even when it contains sub-parts (a), (b), etc.
- Preserve the question wording verbatim; do not omit instructions, numbering, or formatting cues.
- Use the instructions field only for teacher-facing notes that are separate from the student prompt.
- Do not fabricate content. If no valid question exists, return [].`;

  const userPrompt = `Extract distinct assessment questions from the following content. Focus on question statements that can be asked to students.

Ensure each question you return includes every related instruction, bullet, and sub-part that accompanies it. Never split multi-part questions into separate entries. Preserve the original formatting by inserting \\n where new lines occur.

Source material:
"""
${textChunk}
"""`;

  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-3.5-turbo',
    temperature: 0.2,
    max_tokens: 1500,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  }, {
    headers: {
      'Authorization': `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json'
    }
  });

  const content = response.data?.choices?.[0]?.message?.content ?? '[]';
  return content;
};

const sanitizeExtractedQuestion = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const questionText = typeof raw.question === 'string' ? raw.question.trim() : '';
  if (!questionText) {
    return null;
  }

  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : '';
  if (!summary) {
    return null;
  }

  const difficulty = typeof raw.difficulty === 'string'
    ? raw.difficulty.toLowerCase().trim()
    : '';

  const allowedDifficulty = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';
  const type = typeof raw.type === 'string' && ['MCQ', 'SA'].includes(raw.type)
    ? raw.type
    : 'SA';

  return {
    summary,
    question: questionText,
    instructions: typeof raw.instructions === 'string' ? raw.instructions.trim() || undefined : undefined,
    difficulty: allowedDifficulty,
    answer: typeof raw.answer === 'string' ? raw.answer.trim() || null : null,
    type
  };
};

export const extractQuestionsFromText = async (rawText) => {
  const normalized = normalizeExtractText(rawText);
  if (!normalized) {
    return [];
  }

  const chunks = chunkText(normalized);
  const extracted = [];

  for (const chunk of chunks) {
    const response = await callOpenAIForExtraction(chunk);
    try {
      const parsed = JSON.parse(response);
      if (Array.isArray(parsed)) {
        extracted.push(...parsed);
      }
    } catch (error) {
      // If parsing fails, ignore this chunk but continue processing others
      console.error('Failed to parse extraction response', error);
    }
  }

  const deduped = [];
  const seen = new Set();
  extracted.forEach((item) => {
    const sanitized = sanitizeExtractedQuestion(item);
    if (!sanitized) return;
    const key = sanitized.question.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(sanitized);
    }
  });

  return deduped;
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
