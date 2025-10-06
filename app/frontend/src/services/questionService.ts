import api from './api';
import { 
  Question, 
  QuestionCreate, 
  QuestionMetadata, 
  QuestionGenerationParams, 
  QuestionStats,
  ExtractedQuestion,
  SavedExtractedQuestion
} from '../types/question';

export const questionService = {
  async getQuestions(options: {
    classId?: number;
    difficulty?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Question[]> {
    const response = await api.get('/api/questions', { params: options });
    return response.data.data;
  },

  async getQuestion(id: number): Promise<Question> {
    const response = await api.get(`/api/questions/${id}`);
    return response.data.data;
  },

  async createQuestion(question: QuestionCreate): Promise<Question> {
    const response = await api.post('/api/questions', question);
    return response.data.data;
  },

  async updateQuestion(id: number, question: Partial<QuestionCreate>): Promise<Question> {
    const response = await api.put(`/api/questions/${id}`, question);
    return response.data.data;
  },

  async deleteQuestion(id: number): Promise<void> {
    await api.delete(`/api/questions/${id}`);
  },

  async generateQuestions(params: QuestionGenerationParams): Promise<QuestionMetadata[]> {
    const response = await api.post('/api/questions/generate', params);
    return response.data.data;
  },

  async approveQuestions(questions: QuestionMetadata[], classId?: number): Promise<Question[]> {
    const response = await api.post('/api/questions/approve', { questions, classId });
    return response.data.data;
  },

  async getQuestionStats(): Promise<QuestionStats> {
    const response = await api.get('/api/questions/stats');
    return response.data.data;
  },

  async extractQuestionsFromText(text: string, provider = 'openai'): Promise<ExtractedQuestion[]> {
    const response = await api.post('/api/questions/extract', { text, provider });
    return response.data.data;
  },

  async saveExtractedQuestions(payload: {
    courseId: number;
    topicId?: number;
    topicName?: string;
    type?: 'MCQ' | 'SA';
    defaultDifficulty?: 'easy' | 'medium' | 'hard';
    questions: ExtractedQuestion[];
  }): Promise<SavedExtractedQuestion[]> {
    const response = await api.post('/api/questions/extract/save', payload);
    return response.data.data;
  }
};
