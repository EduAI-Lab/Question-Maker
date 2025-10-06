import api from './api';
import {
  Question,
  QuestionCreate,
  QuestionMetadata,
  QuestionGenerationParams,
  QuestionStats,
  QuestionVariant,
  QuestionDifficulty
} from '../types/question';

const mapVariant = (variant: any): QuestionVariant => ({
  id: variant.id,
  questionText: variant.questionText,
  difficulty: variant.difficulty ?? 'medium',
  answer: variant.answer ?? null,
  assessmentId: variant.assessmentId ?? null,
  secondaryTopicsId: Array.isArray(variant.secondaryTopicsId) ? variant.secondaryTopicsId : [],
  referenceId: variant.referenceId ?? null,
  baseReferenceId: variant.referenceId ?? variant.id ?? null,
  createdAt: variant.createdAt,
  updatedAt: variant.updatedAt
});

const mapQuestion = (item: any): Question => ({
  id: item.id,
  description: item.description,
  type: item.type,
  courseId: item.courseId,
  primaryTopicId: item.primaryTopicId,
  questionOrder: item.questionOrder || null,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  course: item.course
    ? {
        id: item.course.id,
        name: item.course.name,
        code: item.course.code
      }
    : undefined,
  variants: Array.isArray(item.variants) ? item.variants.map(mapVariant) : [],
  content: item.description,
  difficulty: item.variants && item.variants[0] ? item.variants[0].difficulty : 'medium',
  bloomLevel: 'understand',
  classId: item.courseId,
  class: item.course
    ? {
        id: item.course.id,
        name: item.course.name,
        subject: item.course.code || ''
      }
    : undefined
});

export const questionService = {
  async getQuestions(options: {
    courseId?: number;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Question[]> {
    const params: Record<string, unknown> = {};
    if (options.courseId !== undefined) params.courseId = options.courseId;
    if (options.search !== undefined) params.search = options.search;
    if (options.limit !== undefined) params.limit = options.limit;
    if (options.offset !== undefined) params.offset = options.offset;

    const response = await api.get('/api/questions', { params });
    return (response.data.data || []).map(mapQuestion);
  },

  async getQuestion(id: number): Promise<Question> {
    const response = await api.get(`/api/questions/${id}`);
    return mapQuestion(response.data.data);
  },

  async createQuestion(question: QuestionCreate): Promise<Question> {
    const response = await api.post('/api/questions', question);
    return mapQuestion(response.data.data);
  },

  async updateQuestion(id: number, question: Partial<QuestionCreate>): Promise<Question> {
    const response = await api.put(`/api/questions/${id}`, question);
    return mapQuestion(response.data.data);
  },

  async deleteQuestion(id: number): Promise<void> {
    await api.delete(`/api/questions/${id}`);
  },

  async createVariant(questionId: number, payload: {
    questionText: string;
    difficulty?: QuestionDifficulty;
    assessmentId?: number;
    secondaryTopicsId?: number[];
    answer?: string | null;
    referenceId?: number;
  }): Promise<QuestionVariant> {
    const response = await api.post(`/api/questions/${questionId}/variants`, payload);
    return mapVariant(response.data.data);
  },

  async deleteVariant(variantId: number): Promise<void> {
    await api.delete(`/api/questions/variants/${variantId}`);
  },

  async generateQuestions(params: QuestionGenerationParams): Promise<QuestionMetadata[]> {
    const response = await api.post('/api/questions/generate', params);
    return response.data.data;
  },

  async approveQuestions(questions: QuestionMetadata[], courseId?: number): Promise<Question[]> {
    const response = await api.post('/api/questions/approve', { questions, courseId });
    return (response.data.data || []).map(mapQuestion);
  },

  async getQuestionStats(): Promise<QuestionStats> {
    const response = await api.get('/api/questions/stats');
    return response.data.data;
  }
};
