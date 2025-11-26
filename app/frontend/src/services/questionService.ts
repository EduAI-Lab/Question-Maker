import api from './api';
import {
  Question,
  QuestionCreate,
  QuestionMetadata,
  QuestionGenerationParams,
  QuestionStats,
  QuestionVariant,
  QuestionDifficulty,
  ExtractedQuestion
} from '../types/question';

const mapVariant = (variant: any): QuestionVariant => ({
  id: variant.id,
  questionText: variant.questionText,
  difficulty: variant.difficulty ?? 'medium',
  reasoningLevel: variant.reasoningLevel ?? variant.reasoning_level ?? undefined,
  answer: variant.answer ?? null,
  questionMetadataId: variant.questionMetadataId ?? variant.question_metadata_id ?? undefined,
  assessmentId: variant.assessmentId ?? null,
  secondaryTopicsId: Array.isArray(variant.secondaryTopicsId)
    ? variant.secondaryTopicsId
    : Array.isArray(variant.secondary_topics_id)
      ? variant.secondary_topics_id
      : [],
  referenceId: variant.referenceId ?? variant.reference_id ?? null,
  createdAt: variant.createdAt ?? variant.created_at,
  updatedAt: variant.updatedAt ?? variant.updated_at,
  assessment: variant.assessment
    ? {
        id: variant.assessment.id,
        name: variant.assessment.name,
        type: variant.assessment.type,
        semester: variant.assessment.semester,
        createdAt: variant.assessment.createdAt ?? '',
        updatedAt: variant.assessment.updatedAt ?? ''
      }
    : undefined
});

const mapQuestion = (item: any): Question => ({
  id: item.id,
  description: item.description ?? null,
  type: item.type,
  courseId: item.courseId,
  primaryTopicId: item.primaryTopicId,
  questionOrder: item.questionOrder ?? null,
  isAiGenerated: item.isAiGenerated ?? item.is_ai_generated ?? false,
  isDraft: item.isDraft ?? item.is_draft ?? false,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  course: item.course
    ? {
        id: item.course.id,
        name: item.course.name,
        code: item.course.code
      }
    : undefined,
  variants: Array.isArray(item.variants) ? item.variants.map(mapVariant) : []
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
  },

  async extractQuestionsFromText(payload: { text: string; courseId: number; model?: string; apiKeys?: Record<string, any> }): Promise<ExtractedQuestion[]> {
    const response = await api.post('/api/questions/extract', payload);
    return response.data.data || [];
  },

  async saveExtractedQuestions(payload: {
    courseId: number;
    primaryTopicId?: number;
    topicName?: string;
    questions: ExtractedQuestion[];
    assessment?: {
      type: string;
      name: string;
      semester: string;
    };
  }): Promise<{ questions: Question[]; assessmentId: number | null }> {
    const response = await api.post('/api/questions/extract/save', payload);
    const data = response.data.data;
    return {
      questions: (data.questions || []).map(mapQuestion),
      assessmentId: data.assessmentId || null
    };
  }
};
