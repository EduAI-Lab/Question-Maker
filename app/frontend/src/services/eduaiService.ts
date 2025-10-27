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
      description?: string;
      difficulty: 'easy' | 'medium' | 'hard';
      reasoning_level: 'factual' | 'analytical' | 'application';
      bloom_level: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
      type: 'MCQ' | 'SA';
      primary_topic_id?: number | null;
      secondary_topic_ids?: number[];
    }>;
    count: number;
    course: {
      id: number;
      name: string;
      code: string;
    };
  };
}

export interface EduAIModelOption {
  id: string;
  label: string;
  provider: 'ollama' | 'google' | 'openai' | 'other';
  description?: string;
  isDefault?: boolean;
}

export interface EduAICourseOption {
  id: string;
  code: string;
  name: string;
  description?: string;
}

const MOCK_MODEL_OPTIONS: EduAIModelOption[] = [
  {
    id: 'ollama:gpt-oss:120b',
    label: 'Gpt-oss:120b',
    provider: 'ollama',
    description: 'Runs locally via Ollama. No provider API key required.',
    isDefault: true
  },
  {
    id: 'google:gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'google',
    description: 'Fast multimodal model suitable for real-time question generation.'
  },
  {
    id: 'google:gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'google',
    description: 'Higher-quality Gemini model for complex reasoning.'
  },
  {
    id: 'deepseek:deepseek-r1:8b',
    label: 'Deepseek-r1:8b',
    provider: 'other',
    description: 'Open-source reasoning model tuned for educational domains.'
  },
  {
    id: 'openai:gpt-4.1',
    label: 'GPT-4.1',
    provider: 'openai',
    description: 'Latest GPT-4.1 model for top-tier accuracy.'
  },
  {
    id: 'openai:gpt-4o',
    label: 'GPT-4o',
    provider: 'openai',
    description: 'Optimized GPT-4 model balancing quality and speed.'
  },
  {
    id: 'openai:gpt-4o-mini',
    label: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Lightweight GPT-4o variant for lower-latency prompts.'
  },
  {
    id: 'openai:o4-mini',
    label: 'OpenAI o4 Mini',
    provider: 'openai',
    description: 'Experimental o4 mini model for quick iterations.'
  }
];

const MOCK_COURSE_OPTIONS: EduAICourseOption[] = [
  {
    id: 'COSC121',
    code: 'COSC 121',
    name: 'Computer Programming I',
    description: 'Introductory programming course focusing on problem solving.'
  },
  {
    id: 'COSC211',
    code: 'COSC 211',
    name: 'Machine Learning Basics',
    description: 'Fundamentals of supervised and unsupervised learning.'
  }
];

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
   * Mock: Return available EduAI model options.
   * Replace with real API call when endpoint is available.
   */
  async listModels(): Promise<EduAIModelOption[]> {
    return MOCK_MODEL_OPTIONS;
  }

  /**
   * Mock: Return EduAI course inventory.
   * Replace with real API call when endpoint is available.
   */
  async listCourses(): Promise<EduAICourseOption[]> {
    return MOCK_COURSE_OPTIONS;
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
