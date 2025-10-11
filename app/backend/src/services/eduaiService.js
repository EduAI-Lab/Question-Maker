import axios from 'axios';
import { config } from '../config/settings.js';

/**
 * EduAI Service - Integration with external EduAI RAG API
 * Provides course-aware AI assistance for question generation
 */

class EduAIService {
  constructor() {
    this.baseURL = config.eduaiApiUrl;
    this.apiKey = config.eduaiApiKey;
    
    console.log('EduAI Service initialized:', {
      baseURL: this.baseURL,
      hasApiKey: !!this.apiKey,
      apiKeyLength: this.apiKey ? this.apiKey.length : 0,
      apiKeyPrefix: this.apiKey ? this.apiKey.substring(0, 8) + '...' : 'none'
    });
    
    if (!this.apiKey) {
      console.warn('EduAI API key not configured. EduAI features will be disabled.');
    }
  }

  /**
   * Check if EduAI service is properly configured
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Send a chat request to EduAI API with course context
   * @param {Object} params - Chat parameters
   * @param {Array} params.messages - Chat message history
   * @param {string} params.model - AI model identifier (e.g., 'google:gemini-2.5-flash', 'ollama:gpt-oss:120b')
   * @param {Object} params.apiKeys - Provider-specific API keys
   * @param {string} params.courseCode - Target course identifier
   * @param {boolean} params.streaming - Enable response streaming
   * @returns {Promise<Object>} Chat response
   */
  async chat(params) {
    if (!this.isConfigured()) {
      throw new Error('EduAI service is not configured. Please set EDUAI_API_KEY environment variable.');
    }

    try {
      const response = await axios.post(`${this.baseURL}/api/chat`, {
        messages: params.messages || [],
        model: params.model || 'google:gemini-2.5-flash',
        apiKeys: params.apiKeys || {},
        courseCode: params.courseCode,
        streaming: params.streaming || false
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        timeout: 30000 // 30 second timeout
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        // API returned an error response
        const errorMessage = error.response.data?.error || error.response.data?.message || error.response.statusText;
        const statusCode = error.response.status;
        console.error('EduAI API Error:', {
          status: statusCode,
          statusText: error.response.statusText,
          data: error.response.data,
          url: `${this.baseURL}/api/chat`,
          headers: error.response.headers
        });
        throw new Error(`EduAI API error (${statusCode}): ${errorMessage}`);
      } else if (error.request) {
        // Request was made but no response received
        console.error('EduAI Request Error:', error.request);
        throw new Error('EduAI API request failed: No response received');
      } else {
        // Something else happened
        console.error('EduAI Error:', error.message);
        throw new Error(`EduAI API error: ${error.message}`);
      }
    }
  }

  /**
   * Generate questions using EduAI with course context
   * @param {Object} params - Question generation parameters
   * @param {string} params.prompt - Question generation prompt
   * @param {string} params.courseCode - Course code for context
   * @param {string} params.model - AI model to use
   * @param {Object} params.apiKeys - Provider API keys
   * @param {number} params.numQuestions - Number of questions to generate
   * @param {Object} params.difficultyDistribution - Difficulty distribution
   * @returns {Promise<Array>} Generated questions
   */
  async generateQuestions(params) {
    const {
      prompt,
      courseCode,
      model = 'google:gemini-2.5-flash',
      apiKeys = {},
      numQuestions = 5,
      difficultyDistribution = { easy: 1, medium: 2, hard: 2 }
    } = params;

    if (!prompt || !courseCode) {
      throw new Error('Prompt and courseCode are required for question generation');
    }

    const systemPrompt = `You are an expert question generator for educational assessments. Generate exactly ${numQuestions} high-quality questions based on the course material.

Requirements:
- Generate exactly ${numQuestions} questions
- Difficulty distribution: Easy: ${difficultyDistribution.easy}, Medium: ${difficultyDistribution.medium}, Hard: ${difficultyDistribution.hard}
- Each question should be relevant to the course material
- Format each question as a JSON object with these exact fields:
  {
    "content": "The complete question text",
    "difficulty": "easy/medium/hard",
    "bloom_level": "remember/understand/apply/analyze/evaluate/create",
    "type": "MCQ/SA"
  }

IMPORTANT: Return ONLY a valid JSON array of question objects. No other text.`;

    const userPrompt = `Generate questions about: ${prompt}

Please ensure the questions are appropriate for the course level and cover the key concepts comprehensively.`;

    try {
      const response = await this.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        model,
        apiKeys,
        courseCode,
        streaming: false
      });

      // Parse the response
      let questions;
      try {
        questions = JSON.parse(response.content || response.message || response);
      } catch (parseError) {
        // If parsing fails, try to extract JSON from the response
        const jsonMatch = (response.content || response.message || response).match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          questions = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse questions from EduAI response');
        }
      }

      // Validate questions
      if (!Array.isArray(questions)) {
        throw new Error('EduAI response is not an array of questions');
      }

      // Filter and validate each question
      const validQuestions = questions.filter(q => 
        q.content && 
        q.difficulty && 
        q.bloom_level &&
        ['easy', 'medium', 'hard'].includes(q.difficulty) &&
        ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'].includes(q.bloom_level)
      );

      if (validQuestions.length === 0) {
        throw new Error('No valid questions found in EduAI response');
      }

      return validQuestions;
    } catch (error) {
      throw new Error(`EduAI question generation failed: ${error.message}`);
    }
  }

  /**
   * Get available AI models from EduAI
   * @returns {Promise<Array>} Available models
   */
  async getAvailableModels() {
    // This would typically be an API call to get available models
    // For now, return common models based on the documentation
    return [
      { id: 'google:gemini-2.5-flash', name: 'Google Gemini 2.5 Flash', provider: 'google' },
      { id: 'ollama:gpt-oss:120b', name: 'Ollama GPT OSS 120B', provider: 'ollama' },
      { id: 'openai:gpt-4', name: 'OpenAI GPT-4', provider: 'openai' }
    ];
  }

  /**
   * Test the EduAI connection
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection() {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'EduAI API key not configured'
      };
    }

    try {
      // First, try a simple health check without course context
      const healthResponse = await axios.get(`${this.baseURL}/api/health`, {
        headers: {
          'x-api-key': this.apiKey
        },
        timeout: 10000
      });

      return {
        success: true,
        message: 'EduAI connection successful',
        response: healthResponse.data
      };
    } catch (error) {
      // If health check fails, try a minimal chat request
      try {
        const response = await this.chat({
          messages: [{ role: 'user', content: 'Hello, this is a test message.' }],
          model: 'ollama:gpt-oss:120b', // Use Ollama which doesn't need API key
          apiKeys: {
            ollama: {
              isEnabled: true
            }
          },
          courseCode: 'DATA 301', // Try the course code from documentation
          streaming: false
        });

        return {
          success: true,
          message: 'EduAI connection successful',
          response: response
        };
      } catch (chatError) {
        return {
          success: false,
          error: `EduAI connection failed: ${chatError.message}`,
          details: {
            healthCheckError: error.message,
            chatError: chatError.message
          }
        };
      }
    }
  }

  /**
   * Test API key validity by making a simple chat request
   * @returns {Promise<Object>} API key test result
   */
  async testApiKey() {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'EduAI API key not configured'
      };
    }

    try {
      // Test the API key by making a minimal chat request with Ollama
      const response = await this.chat({
        messages: [{ role: 'user', content: 'test' }],
        model: 'ollama:gpt-oss:120b', // Use Ollama which doesn't need API key
        apiKeys: {
          ollama: {
            isEnabled: true
          }
        },
        courseCode: 'COSC 121',
        streaming: false
      });

      return {
        success: true,
        message: 'API key is valid',
        response: response
      };
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        return {
          success: false,
          error: 'Invalid EduAI API key - authentication failed'
        };
      } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
        return {
          success: false,
          error: 'EduAI API key access forbidden'
        };
      } else if (error.message.includes('Invalid API key') || error.message.includes('test-key')) {
        return {
          success: true,
          message: 'EduAI API key is valid (provider API key test failed as expected)',
          note: 'The EduAI API key works, but you need to provide valid AI provider API keys'
        };
      } else {
        return {
          success: false,
          error: `API key test failed: ${error.message}`,
          statusCode: error.response?.status
        };
      }
    }
  }
}

// Export singleton instance
export const eduaiService = new EduAIService();
export default eduaiService;
