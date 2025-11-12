import axios from "axios";
import { config } from "../config/settings.js";
import { Question_Metadata, Topics, Course } from "../schema/index.js";
import eduaiService from "./eduaiService.js";

const AI_PROVIDERS = {
  GROQ: "groq",
  OPENAI: "openai",
  DEEPSEEK: "deepseek",
};

const callGroqAPI = async (prompt, params) => {
  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
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
          }`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        top_p: 0.9,
        stream: false,
      },
      {
        headers: {
          Authorization: `Bearer ${config.groqApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    throw new Error(`Groq API error: ${error.message}`);
  }
};

// Legacy: OpenAI generator kept for reference; newer flows use EduAI instead.
const callOpenAIAPI = async (prompt, params) => {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
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

          Topic to generate questions about: ${prompt}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      },
      {
        headers: {
          Authorization: `Bearer ${config.openaiApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    throw new Error(`OpenAI API error: ${error.message}`);
  }
};

const callDeepSeekAPI = async (prompt, params) => {
  try {
    const response = await axios.post(
      "https://api.deepseek.com/v1/chat/completions",
      {
        model: "deepseek-coder",
        messages: [
          {
            role: "user",
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

          Topic to generate questions about: ${prompt}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        stream: false,
      },
      {
        headers: {
          Authorization: `Bearer ${config.deepseekApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    throw new Error(`DeepSeek API error: ${error.message}`);
  }
};

const normalizeExtractText = (text) => {
  if (!text) return "";
  return (
    text
      .replace(/\r\n/g, "\n")
      .replace(/\t/g, " ")
      .replace(/\u00a0/g, " ")
      // collapse runs of more than two newlines to a double newline
      .replace(/\n{3,}/g, "\n\n")
      // collapse excessive spaces while preserving newlines
      .replace(/[ ]{2,}/g, " ")
      .trim()
  );
};

const chunkText = (text, chunkSize = 6000) => {
  if (!text) return [];
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
};

const summarizeQuestion = (text) => {
  if (!text) return "Question";
  const sanitized = text.replace(/\s+/g, " ").trim();
  if (!sanitized) return "Question";
  const words = sanitized.split(" ");
  if (words.length <= 12) {
    return sanitized.replace(/\?+$/, "");
  }
  return `${words.slice(0, 12).join(" ")}…`;
};

const calculateQuestionTarget = (chunk) => {
  if (!chunk) return 3;
  const estimated = Math.round(chunk.length / 900);
  return Math.max(3, Math.min(12, estimated));
};

const buildDifficultyCounts = (total) => {
  let easy = Math.max(1, Math.floor(total * 0.4));
  let medium = Math.max(1, Math.floor(total * 0.4));
  let hard = total - easy - medium;
  if (hard < 0) {
    hard = 0;
  }
  if (hard === 0 && total > easy + medium) {
    hard = total - easy - medium;
  }
  let adjustment = total - (easy + medium + hard);
  if (adjustment !== 0) {
    hard += adjustment;
    if (hard < 0) {
      medium = Math.max(1, medium + hard);
      hard = 0;
    }
    adjustment = total - (easy + medium + hard);
    if (adjustment !== 0) {
      easy = Math.max(1, easy + adjustment);
    }
  }
  return {
    easy: Math.max(0, easy),
    medium: Math.max(0, medium),
    hard: Math.max(0, hard),
  };
};

const sanitizeEduAIQuestion = (question) => {
  const content =
    typeof question?.content === "string" ? question.content.trim() : "";
  if (!content) return null;
  const summarySource =
    typeof question?.description === "string" &&
    question.description.trim().length > 0
      ? question.description.trim()
      : summarizeQuestion(content);

  const difficulty = ["easy", "medium", "hard"].includes(
    question?.difficulty?.toLowerCase()
  )
    ? question.difficulty.toLowerCase()
    : "medium";

  const type = question?.type === "MCQ" ? "MCQ" : "SA";
  const primaryTopicId =
    Number.isInteger(question?.primary_topic_id) &&
    question.primary_topic_id > 0
      ? Number(question.primary_topic_id)
      : null;
  const secondaryTopicIds = Array.isArray(question?.secondary_topic_ids)
    ? Array.from(
        new Set(
          question.secondary_topic_ids
            .map((value) => Number(value))
            .filter(
              (value) => Number.isInteger(value) && value !== primaryTopicId
            )
        )
      )
    : [];

  return {
    summary: summarySource,
    question: content,
    instructions: undefined,
    difficulty,
    answer: null,
    type,
    primaryTopicId,
    secondaryTopicIds,
  };
};

const extractQuestionsWithEduAI = async (text, course) => {
  if (!eduaiService.isConfigured()) {
    throw new Error(
      "EduAI service is not configured. Please set EDUAI_API_KEY."
    );
  }

  const rawCode =
    (course?.code && course.code.trim()) || `COURSE-${course?.id ?? "UNKNOWN"}`;
  const courseCode = rawCode.replace(/\s+/g, "").toUpperCase();
  const chunks = chunkText(text, 4000);
  const model = "ollama:gpt-oss:120b";
  const extracted = [];

  for (const chunk of chunks) {
    const numQuestions = calculateQuestionTarget(chunk);
    const difficultyDistribution = buildDifficultyCounts(numQuestions);
    const reasoningDistribution = {
      factual: 40,
      analytical: 30,
      application: 30,
    };

    const prompt = `You are an assistant that extracts exam-ready questions from source material.
The following text may contain multiple questions, sub-parts, and instructions. Identify complete question blocks and return ONLY high-quality student-ready questions.

Requirements:
- Preserve numbering, sub-parts, and important instructions.
- If a question has parts (a), (b), etc., keep them together in a single prompt using \\n for new lines.
- Provide a concise "description" (<= 12 words) that summarizes the question without repeating it verbatim.
- Format answers as null (omit if unknown). Do NOT fabricate answers.

Source material:
"""
${chunk}
"""`;

    try {
      const apiKeys =
        model && model.startsWith("ollama")
          ? { ollama: { isEnabled: true } }
          : {};

      const questions = await eduaiService.generateQuestions({
        prompt,
        courseCode,
        model,
        apiKeys,
        numQuestions,
        difficultyDistribution,
        reasoningDistribution,
      });
      const sanitized = questions
        .map((question) => sanitizeEduAIQuestion(question))
        .filter(Boolean);
      extracted.push(...sanitized);
    } catch (error) {
      console.error("EduAI extraction failed for chunk", error.message);
      throw error;
    }
  }

  const seen = new Set();
  const deduped = [];
  extracted.forEach((question) => {
    const key = `${question.summary.toLowerCase()}::${question.question.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(question);
    }
  });
  return deduped;
};

// Legacy: OpenAI extractor retained for reference; current upload flow uses EduAI.
const callOpenAIForExtraction = async (textChunk) => {
  if (!config.openaiApiKey) {
    throw new Error(
      "OpenAI API key is not configured. Please add it to the .env file."
    );
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

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-3.5-turbo",
      temperature: 0.2,
      max_tokens: 1500,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  const content = response.data?.choices?.[0]?.message?.content ?? "[]";
  return content;
};

const sanitizeExtractedQuestion = (raw) => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const questionText =
    typeof raw.question === "string" ? raw.question.trim() : "";
  if (!questionText) {
    return null;
  }

  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  if (!summary) {
    return null;
  }

  const difficulty =
    typeof raw.difficulty === "string"
      ? raw.difficulty.toLowerCase().trim()
      : "";

  const allowedDifficulty = ["easy", "medium", "hard"].includes(difficulty)
    ? difficulty
    : "medium";
  const type =
    typeof raw.type === "string" && ["MCQ", "SA"].includes(raw.type)
      ? raw.type
      : "SA";

  return {
    summary,
    question: questionText,
    instructions:
      typeof raw.instructions === "string"
        ? raw.instructions.trim() || undefined
        : undefined,
    difficulty: allowedDifficulty,
    answer: typeof raw.answer === "string" ? raw.answer.trim() || null : null,
    type,
    primaryTopicId: null,
    secondaryTopicIds: [],
  };
};

// Legacy: OpenAI topic assignment retained for reference; current pipeline uses EduAI metadata.
const callOpenAIForTopicAssignment = async (questions, topics) => {
  if (!config.openaiApiKey) {
    throw new Error(
      "OpenAI API key is not configured. Please add it to the .env file."
    );
  }

  const systemPrompt = `You are an assistant that assigns course topics to questions.
You will receive JSON with two arrays: topics and questions.
- topics: array of { "id": number, "name": string }
- questions: array of { "index": number, "summary": string, "question": string }

Return ONLY a JSON array. Each element must have:
{
  "index": number,                 // matches the question index from input
  "primaryTopicId": number | null, // id from provided topics, or null if no good match
  "secondaryTopicIds": number[]    // optional additional topic ids, exclude the primary id, no duplicates
}

Use only IDs from the provided topics. Keep the array order identical to the input questions.`;

  const payload = JSON.stringify(
    {
      topics: topics.map((topic) => ({
        id: topic.id,
        name: topic.name,
      })),
      questions: questions.map((question, index) => ({
        index,
        summary: question.summary,
        question: question.question,
      })),
    },
    null,
    2
  );

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-3.5-turbo",
      temperature: 0,
      max_tokens: 1200,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: payload },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data?.choices?.[0]?.message?.content ?? "[]";
};

const sanitizeTopicAssignment = (raw, validTopicIds) => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const index = Number(raw.index);
  if (!Number.isInteger(index) || index < 0) {
    return null;
  }

  let primaryTopicId = raw.primaryTopicId;
  if (primaryTopicId === null || primaryTopicId === undefined) {
    primaryTopicId = null;
  } else {
    primaryTopicId = Number(primaryTopicId);
    if (!validTopicIds.has(primaryTopicId)) {
      primaryTopicId = null;
    }
  }

  let secondaryTopicIds = [];
  if (Array.isArray(raw.secondaryTopicIds)) {
    const seen = new Set();
    secondaryTopicIds = raw.secondaryTopicIds
      .map((value) => Number(value))
      .filter((value) => {
        if (!validTopicIds.has(value)) {
          return false;
        }
        if (value === primaryTopicId) {
          return false;
        }
        if (seen.has(value)) {
          return false;
        }
        seen.add(value);
        return true;
      });
  }

  return {
    index,
    primaryTopicId,
    secondaryTopicIds,
  };
};

const enrichQuestionsWithTopics = async (questions, courseId) => {
  if (!courseId) {
    return questions;
  }

  const topics = await Topics.findAll({
    where: { courseId },
    order: [["id", "ASC"]],
  });

  if (topics.length === 0) {
    return questions;
  }

  try {
    const response = await callOpenAIForTopicAssignment(questions, topics);
    const parsed = JSON.parse(response);
    if (!Array.isArray(parsed)) {
      return questions;
    }

    const validTopicIds = new Set(topics.map((topic) => topic.id));
    const assignmentMap = new Map();

    parsed.forEach((item) => {
      const sanitized = sanitizeTopicAssignment(item, validTopicIds);
      if (sanitized) {
        assignmentMap.set(sanitized.index, sanitized);
      }
    });

    const fallbackTopicId = topics[0]?.id ?? null;

    return questions.map((question, index) => {
      const assignment = assignmentMap.get(index);
      const primaryTopicId =
        assignment?.primaryTopicId ??
        fallbackTopicId ??
        question.primaryTopicId ??
        null;
      const candidateSecondary = Array.isArray(assignment?.secondaryTopicIds)
        ? [...assignment.secondaryTopicIds]
        : Array.isArray(question.secondaryTopicIds)
        ? [...question.secondaryTopicIds]
        : [];
      const secondaryTopicIds = candidateSecondary.filter(
        (id) => id !== primaryTopicId
      );

      return {
        ...question,
        primaryTopicId,
        secondaryTopicIds,
      };
    });
  } catch (error) {
    console.error("Failed to assign topics via AI", error);
    return questions;
  }
};

export const extractQuestionsFromText = async (rawText, courseId) => {
  const normalized = normalizeExtractText(rawText);
  if (!normalized) {
    return [];
  }

  const course = await Course.findByPk(courseId, {
    attributes: ["id", "code", "name"],
  });

  const extracted = await extractQuestionsWithEduAI(normalized, course);
  return extracted;
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
        throw new Error("Response is not an array");
      }

      // Validate each question
      const validQuestions = questions.filter(
        (q) =>
          q.content &&
          q.difficulty &&
          q.bloom_level &&
          ["easy", "medium", "hard"].includes(q.difficulty) &&
          [
            "remember",
            "understand",
            "apply",
            "analyze",
            "evaluate",
            "create",
          ].includes(q.bloom_level)
      );

      if (validQuestions.length === 0) {
        throw new Error("No valid questions found in response");
      }

      return validQuestions;
    } catch (parseError) {
      // If parsing fails, return a single question with the response text
      return [
        {
          content: response,
          difficulty: "medium",
          bloom_level: "understand",
        },
      ];
    }
  } catch (error) {
    throw error;
  }
};

export { AI_PROVIDERS };
