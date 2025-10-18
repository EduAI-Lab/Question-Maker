import api from './api';

export interface EduAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface EduAIChatRequest {
  messages: EduAIMessage[];
  model?: string;
  apiKeys?: Record<string, any>;
  courseCode: string;
  streaming?: boolean;
}

export interface EduAIChatResponse {
  success: boolean;
  data: any;
  course: {
    id: number;
    name: string;
    code: string;
  };
}

export interface EduAIQuestionGenerationRequest {
  prompt: string;
  courseCode: string;
  model?: string;
  apiKeys?: Record<string, any>;
  numQuestions?: number;
  difficultyDistribution?: {
    easy: number;
    medium: number;
    hard: number;
  };
  reasoningDistribution?: {
    factual: number;
    analytical: number;
    application: number;
  };
}

export interface EduAIQuestionGenerationResponse {
  success: boolean;
  data: {
    questions: Array<{
      content: string;
      difficulty: 'easy' | 'medium' | 'hard';
      reasoning_level: 'factual' | 'analytical' | 'application';
      bloom_level: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
      type: 'MCQ' | 'SA';
    }>;
    count: number;
    course: {
      id: number;
      name: string;
      code: string;
    };
  };
}


export interface EduAITestResponse {
  success: boolean;
  message?: string;
  error?: string;
  configured: boolean;
}

class EduAIService {
  /**
   * Send a chat message to EduAI with course context
   */
  async chat(request: EduAIChatRequest): Promise<EduAIChatResponse> {
    const response = await api.post('/api/eduai/chat', request);
    return response.data;
  }

  /**
   * Generate questions using EduAI with course context
   */
  async generateQuestions(request: EduAIQuestionGenerationRequest): Promise<EduAIQuestionGenerationResponse> {
    const response = await api.post('/api/eduai/generate-questions', request);
    return response.data;
  }
 
  /**
   * Test EduAI API key validity
   */
  async testApiKey(): Promise<EduAITestResponse> {
    const response = await api.get('/api/eduai/test-api-key');
    return response.data;
  }

  /**
   * Helper method to create a simple chat message
   */
  createMessage(role: 'user' | 'assistant' | 'system', content: string): EduAIMessage {
    return { role, content };
  }

  /**
   * Helper method to create a question generation request
   */
  createQuestionGenerationRequest(
    prompt: string,
    courseCode: string,
    options: Partial<EduAIQuestionGenerationRequest> = {}
  ): EduAIQuestionGenerationRequest {
    return {
      prompt,
      courseCode,
      model: 'google:gemini-2.5-flash',
      numQuestions: 5,
      difficultyDistribution: { easy: 1, medium: 2, hard: 2 },
      reasoningDistribution: { factual: 40, analytical: 30, application: 30 },
      ...options
    };
  }

  /**
   * Helper method to create a chat request
   */
  createChatRequest(
    messages: EduAIMessage[],
    courseCode: string,
    options: Partial<EduAIChatRequest> = {}
  ): EduAIChatRequest {
    return {
      messages,
      courseCode,
      model: 'google:gemini-2.5-flash',
      streaming: false,
      ...options
    };
  }
}

export const eduaiService = new EduAIService();
export default eduaiService;
