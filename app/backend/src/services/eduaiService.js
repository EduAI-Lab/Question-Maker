/**
 * Thin client around the EduAI API that powers chat, question generation, and catalog lookups.
 * Exposes a singleton so routes/services share configuration and connection state.
 */
import axios from "axios";
import { config } from "../config/settings.js";

class EduAIService {
  constructor() {
    this.baseURL = config.eduaiApiUrl;
    this.apiKey = config.eduaiApiKey;

    console.log("EduAI Service initialized:", {
      baseURL: this.baseURL,
      hasApiKey: !!this.apiKey,
      apiKeyLength: this.apiKey ? this.apiKey.length : 0,
      apiKeyPrefix: this.apiKey ? this.apiKey.substring(0, 8) + "..." : "none",
    });

    if (!this.apiKey) {
      console.warn(
        "EduAI API key not configured. EduAI features will be disabled."
      );
    }
  }

  /** Returns true when the base URL/API key are available and the service can make requests. */
  isConfigured() {
    return !!this.apiKey;
  }

  /** Sends a chat payload to EduAI, handling logging, timeouts, and API error translation. */
  async chat(params) {
    if (!this.isConfigured()) {
      throw new Error(
        "EduAI service is not configured. Please set EDUAI_API_KEY environment variable."
      );
    }

    try {
      const requestPayload = {
        messages: params.messages || [],
        model: params.model || "google:gemini-2.5-flash",
        apiKeys: params.apiKeys || {},
        courseCode: params.courseCode,
        streaming: params.streaming || false,
      };

      console.log("EduAI Request:", {
        url: `${this.baseURL}/api/chat`,
        payload: requestPayload,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey
            ? this.apiKey.substring(0, 8) + "..."
            : "none",
        },
      });

      const response = await axios.post(
        `${this.baseURL}/api/chat`,
        requestPayload,
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey,
          },
          timeout: 60000, // 60 second timeout
        }
      );

      return response.data;
    } catch (error) {
      if (error.response) {
        // API returned an error response
        const errorMessage =
          error.response.data?.error ||
          error.response.data?.message ||
          error.response.statusText;
        const statusCode = error.response.status;
        console.error("EduAI API Error:", {
          status: statusCode,
          statusText: error.response.statusText,
          data: error.response.data,
          url: `${this.baseURL}/api/chat`,
          headers: error.response.headers,
        });
        throw new Error(`EduAI API error (${statusCode}): ${errorMessage}`);
      } else if (error.request) {
        // Request was made but no response received
        console.error("EduAI Request Error:", {
          request: error.request,
          message: error.message,
          code: error.code,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            timeout: error.config?.timeout,
          }
        });
        
        // Provide more specific error messages based on error code
        let errorMessage = "EduAI API request failed: No response received";
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          errorMessage = "EduAI API request timed out after 60 seconds. The server may be slow or overloaded. Please try again.";
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          errorMessage = `EduAI API server is unreachable. Please check your network connection and verify the EduAI service URL (${this.baseURL}) is correct.`;
        } else if (error.code === 'ECONNRESET') {
          errorMessage = "EduAI API connection was reset. The server may have closed the connection. Please try again.";
        } else if (error.code) {
          errorMessage = `EduAI API request failed: ${error.code}. Please check your network connection and try again.`;
        }
        
        throw new Error(errorMessage);
      } else {
        // Something else happened
        console.error("EduAI Error:", error.message);
        throw new Error(`EduAI API error: ${error.message}`);
      }
    }
  }

  /** Generates normalized questions via EduAI, enforcing prompt requirements and parsing JSON responses. */
  async generateQuestions(params) {
    const {
      prompt,
      courseCode,
      model = "google:gemini-2.5-flash",
      apiKeys = {},
      numQuestions = 5,
      difficultyDistribution = { easy: 1, medium: 2, hard: 2 },
      reasoningDistribution = { factual: 40, analytical: 30, application: 30 },
    } = params;

    if (!prompt || !courseCode) {
      throw new Error(
        "Prompt and courseCode are required for question generation"
      );
    }

    const systemPrompt = `You are an expert question generator for educational assessments. Generate exactly ${numQuestions} high-quality questions based on the course material.

Requirements:
- Generate exactly ${numQuestions} questions
- Difficulty distribution: Easy: ${difficultyDistribution.easy}, Medium: ${difficultyDistribution.medium}, Hard: ${difficultyDistribution.hard}
- Reasoning distribution: Factual: ${reasoningDistribution.factual}%, Analytical: ${reasoningDistribution.analytical}%, Application: ${reasoningDistribution.application}%
- Each question should be relevant to the course material
- For each question, you MUST generate a correct answer based on the question content
- Format each question as a JSON object with these exact fields:
  {
    "content": "The complete question text",
    "description": "Brief summary (<= 15 words) that does not simply repeat the question text",
    "difficulty": "easy/medium/hard",
    "reasoning_level": "factual/analytical/application",
    "type": "MCQ/SA/LA",
    "answer": "The correct answer to the question (required for all question types)",
    "primary_topic_id": number | null,
    "secondary_topic_ids": number[]
  }

Answer Guidelines:
- For MCQ questions: Provide the correct option letter (A, B, C, D, etc.) or the full correct answer text
- For SA (Short Answer) questions: Provide a concise, accurate answer (1-3 sentences)
- For LA (Long Answer) questions: Provide a comprehensive, detailed answer that fully addresses the question
- The answer must be accurate and directly address the question content
- Do not leave answers as null or empty - always generate a valid answer

If the user prompt includes a "Course topics" section, use those numeric IDs exactly when setting primary_topic_id and secondary_topic_ids.

ERROR HANDLING:
If you are unable to generate the requested question(s) for any reason (e.g., insufficient information, ambiguous prompt, topic not covered in course material, conflicting requirements), you MUST return a JSON object with this exact format instead of a question array:
{
  "error": true,
  "reason": "A clear, detailed explanation of why you could not generate the question. Be specific about what is missing, unclear, or problematic in the request."
}

IMPORTANT: 
- If you can generate the question(s), return ONLY a valid JSON array of question objects. No other text.
- If you cannot generate the question(s), return ONLY the error object above. No other text.`;

    const userPrompt = `Generate questions about: ${prompt}

Please ensure the questions are appropriate for the course level and cover the key concepts comprehensively.`;

    try {
      const response = await this.chat({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        model,
        apiKeys,
        courseCode,
        streaming: false,
      });

      // Parse the response
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(
          response.content || response.message || response
        );
      } catch (parseError) {
        // If parsing fails, try to extract JSON from the response
        const jsonMatch = (
          response.content ||
          response.message ||
          response
        ).match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Could not parse response from EduAI");
        }
      }

      // Check if the response is an error object
      if (parsedResponse && typeof parsedResponse === 'object' && parsedResponse.error === true) {
        const errorReason = parsedResponse.reason || "AI was unable to generate the question";
        throw new Error(errorReason);
      }

      // Validate that we have an array of questions
      if (!Array.isArray(parsedResponse)) {
        throw new Error("EduAI response is not an array of questions");
      }

      const questions = parsedResponse;

      // Filter and validate each question
      const validQuestions = questions.filter(
        (q) =>
          q.content &&
          q.difficulty &&
          q.reasoning_level &&
          ["easy", "medium", "hard"].includes(q.difficulty) &&
          ["factual", "analytical", "application"].includes(
            q.reasoning_level
          )
      );

      if (validQuestions.length === 0) {
        throw new Error("No valid questions found in EduAI response");
      }

      const normalizedQuestions = validQuestions.map((question) => {
        const content = question.content.trim();

        const description =
          typeof question.description === "string" &&
          question.description.trim().length > 0
            ? question.description.trim()
            : "";

        const primaryCandidate = Number(question.primary_topic_id);
        const primaryTopicId = Number.isInteger(primaryCandidate)
          ? primaryCandidate
          : null;

        const secondaryTopicIds = Array.isArray(question.secondary_topic_ids)
          ? Array.from(
              new Set(
                question.secondary_topic_ids
                  .map((value) => Number(value))
                  .filter(
                    (value) =>
                      Number.isInteger(value) && value !== primaryTopicId
                  )
              )
            )
          : [];

        const answer =
          typeof question.answer === "string" && question.answer.trim().length > 0
            ? question.answer.trim()
            : null;

        return {
          content,
          description,
          difficulty: question.difficulty,
          reasoning_level: question.reasoning_level,
          type:
            typeof question.type === "string" &&
            question.type.toUpperCase().trim() === "SA"
              ? "SA"
              : typeof question.type === "string" &&
                question.type.toUpperCase().trim() === "LA"
                ? "LA"
                : "MCQ",
          answer,
          primary_topic_id: primaryTopicId,
          secondary_topic_ids: secondaryTopicIds,
        };
      });

      return normalizedQuestions;
    } catch (error) {
      throw new Error(`EduAI question generation failed: ${error.message}`);
    }
  }

  /** Lists EduAI-managed courses for onboarding flows. */
  async listCourses() {
    if (!this.isConfigured()) {
      throw new Error(
        "EduAI service is not configured. Please set EDUAI_API_KEY environment variable."
      );
    }

    const url = `${this.baseURL}/api/courses`;

    try {
      const response = await axios.get(url, {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        timeout: 60000, // 60 second timeout
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        const errorMessage =
          error.response.data?.error ||
          error.response.data?.message ||
          error.response.statusText;
        const statusCode = error.response.status;
        console.error("EduAI courses API error:", {
          status: statusCode,
          statusText: error.response.statusText,
          data: error.response.data,
          url,
        });
        throw new Error(`EduAI API error (${statusCode}): ${errorMessage}`);
      } else if (error.request) {
        console.error("EduAI courses request error:", error.request);
        throw new Error("EduAI API request failed: No response received");
      } else {
        console.error("EduAI courses error:", error.message);
        throw new Error(`EduAI API error: ${error.message}`);
      }
    }
  }

  /** Fetches topic metadata for an EduAI course identifier. */
  async getCourseTopics(courseId) {
    if (!this.isConfigured()) {
      throw new Error(
        "EduAI service is not configured. Please set EDUAI_API_KEY environment variable."
      );
    }

    if (!courseId) {
      throw new Error("courseId is required to fetch EduAI topics");
    }

    const url = `${this.baseURL}/api/courses/${courseId}/topics`;

    try {
      const response = await axios.get(url, {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        timeout: 60000, // 60 second timeout
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        const errorMessage =
          error.response.data?.error ||
          error.response.data?.message ||
          error.response.statusText;
        const statusCode = error.response.status;
        console.error("EduAI topics API error:", {
          status: statusCode,
          statusText: error.response.statusText,
          data: error.response.data,
          url,
        });
        throw new Error(`EduAI API error (${statusCode}): ${errorMessage}`);
      } else if (error.request) {
        console.error("EduAI topics request error:", error.request);
        throw new Error("EduAI API request failed: No response received");
      } else {
        console.error("EduAI topics error:", error.message);
        throw new Error(`EduAI API error: ${error.message}`);
      }
    }
  }

  /** Retrieves the list of AI models supported by EduAI for display in pickers. */
  async listAIModels() {
    if (!this.isConfigured()) {
      throw new Error(
        "EduAI service is not configured. Please set EDUAI_API_KEY environment variable."
      );
    }

    const url = `${this.baseURL}/api/ai-models`;

    try {
      const response = await axios.get(url, {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        timeout: 60000, // 60 second timeout
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        const errorMessage =
          error.response.data?.error ||
          error.response.data?.message ||
          error.response.statusText;
        const statusCode = error.response.status;
        console.error("EduAI AI models API error:", {
          status: statusCode,
          statusText: error.response.statusText,
          data: error.response.data,
          url,
        });
        throw new Error(`EduAI API error (${statusCode}): ${errorMessage}`);
      } else if (error.request) {
        console.error("EduAI AI models request error:", error.request);
        throw new Error("EduAI API request failed: No response received");
      } else {
        console.error("EduAI AI models error:", error.message);
        throw new Error(`EduAI API error: ${error.message}`);
      }
    }
  }

  /** Issues a lightweight chat call to validate whether the configured EduAI API key works. */
  async testApiKey() {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "EduAI API key not configured",
      };
    }

    try {
      // Test the API key by making a minimal chat request with Ollama
      const response = await this.chat({
        messages: [{ role: "user", content: "test" }],
        model: "ollama:gpt-oss:120b", // Use Ollama which doesn't need API key
        apiKeys: {
          ollama: {
            isEnabled: true,
          },
        },
        courseCode: "COSC 121",
        streaming: false,
      });

      return {
        success: true,
        message: "API key is valid",
        response: response,
      };
    } catch (error) {
      if (
        error.message.includes("401") ||
        error.message.includes("Unauthorized")
      ) {
        return {
          success: false,
          error: "Invalid EduAI API key - authentication failed",
        };
      } else if (
        error.message.includes("403") ||
        error.message.includes("Forbidden")
      ) {
        return {
          success: false,
          error: "EduAI API key access forbidden",
        };
      } else if (
        error.message.includes("Invalid API key") ||
        error.message.includes("test-key")
      ) {
        return {
          success: true,
          message:
            "EduAI API key is valid (provider API key test failed as expected)",
          note: "The EduAI API key works, but you need to provide valid AI provider API keys",
        };
      } else {
        return {
          success: false,
          error: `API key test failed: ${error.message}`,
          statusCode: error.response?.status,
        };
      }
    }
  }
}

// Export singleton instance
export const eduaiService = new EduAIService();
export default eduaiService;

