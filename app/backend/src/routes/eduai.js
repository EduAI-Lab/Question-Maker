import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import eduaiService from "../services/eduaiService.js";
import { Course } from "../schema/Course.js";

const router = express.Router();

/**
 * @route POST /api/eduai/chat
 * @desc Send a chat message to EduAI with course context
 * @access Private
 */
router.post("/chat", authenticateToken, async (req, res) => {
  try {
    const { messages, model, apiKeys, courseCode, streaming } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    if (!courseCode) {
      return res.status(400).json({ error: "Course code is required" });
    }

    // Note: EduAI manages its own course context, so we don't need to validate
    // against our local database. EduAI will handle course access validation.
    // We'll create a placeholder course object for the response.
    const course = {
      id: 0,
      name: `EduAI Course: ${courseCode}`,
      code: courseCode,
    };

    // Call EduAI service
    const response = await eduaiService.chat({
      messages,
      model: model || "google:gemini-2.5-flash",
      apiKeys: apiKeys || {},
      courseCode,
      streaming: streaming || false,
    });

    res.json({
      success: true,
      data: response,
      course: {
        id: course.id,
        name: course.name,
        code: course.code,
      },
    });
  } catch (error) {
    console.error("EduAI chat error:", error);
    res.status(500).json({
      error: "Failed to process chat request",
      details: error.message,
    });
  }
});

/**
 * @route POST /api/eduai/generate-questions
 * @desc Generate questions using EduAI with course context
 * @access Private
 */
router.post("/generate-questions", authenticateToken, async (req, res) => {
  try {
    const {
      prompt,
      courseCode,
      model,
      apiKeys,
      numQuestions,
      difficultyDistribution,
      reasoningDistribution,
    } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!prompt || !courseCode) {
      return res.status(400).json({
        error: "Prompt and course code are required",
      });
    }

    // Note: EduAI manages its own course context, so we don't need to validate
    // against our local database. EduAI will handle course access validation.
    // We'll create a placeholder course object for the response.
    const course = {
      id: 0,
      name: `EduAI Course: ${courseCode}`,
      code: courseCode,
    };

    // Call EduAI service to generate questions
    const questions = await eduaiService.generateQuestions({
      prompt,
      courseCode,
      model: model || "google:gemini-2.5-flash",
      apiKeys: apiKeys || {},
      numQuestions: numQuestions || 5,
      difficultyDistribution: difficultyDistribution || {
        easy: 1,
        medium: 2,
        hard: 2,
      },
      reasoningDistribution: reasoningDistribution || {
        factual: 40,
        analytical: 30,
        application: 30,
      },
    });

    res.json({
      success: true,
      data: {
        questions,
        count: questions.length,
        course: {
          id: course.id,
          name: course.name,
          code: course.code,
        },
      },
    });
  } catch (error) {
    console.error("EduAI question generation error:", error);
    res.status(500).json({
      error: "Failed to generate questions",
      details: error.message,
    });
  }
});

/**
 * @route POST /api/eduai/extract-preview
 * @desc Preview question extraction using EduAI (debug only)
 * @access Private
 */
router.post("/extract-preview", authenticateToken, async (req, res) => {
  try {
    const { text, courseCode, model, apiKeys } = req.body;
    const trimmedText = typeof text === "string" ? text.trim() : "";

    if (!trimmedText) {
      return res.status(400).json({
        success: false,
        error: "Text content is required for extraction preview",
      });
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
${trimmedText}
"""`;

    const requestPayload = {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: "ollama:gpt-oss:120b",
      apiKeys:
        apiKeys && Object.keys(apiKeys).length > 0
          ? apiKeys
          : { ollama: { isEnabled: true } },
      courseCode: "COSC328",
      streaming: false,
    };

    console.log(
      "[EduAI extract preview] request payload",
      JSON.stringify(requestPayload).slice(0, 2000)
    );

    const response = await eduaiService.chat(requestPayload);

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    if (error.response) {
      console.error(
        "[EduAI extract preview] API error payload",
        error.response.data
      );
    }
    console.error("EduAI extract preview error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to preview extraction with EduAI",
      details: error.message,
    });
  }
});

/**
 * @route GET /api/eduai/test-api-key
 * @desc Test EduAI API key validity
 * @access Private
 */
router.get("/test-api-key", authenticateToken, async (req, res) => {
  try {
    const result = await eduaiService.testApiKey();

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: result.response,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        statusCode: result.statusCode,
      });
    }
  } catch (error) {
    console.error("EduAI API key test error:", error);
    res.status(500).json({
      error: "Failed to test EduAI API key",
      details: error.message,
    });
  }
});

export default router;
