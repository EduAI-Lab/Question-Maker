import api from './api';
import {
  Assessment,
  AssessmentGenerationParams,
  AssessmentBlueprintConfig,
  AssessmentSection,
  AssessmentSectionCreateInput,
  SectionVariantLink
} from '../types/question';

type GetAssessmentsOptions = {
  courseId?: number;
};

const toBlueprintConfig = (payload: AssessmentGenerationParams): AssessmentBlueprintConfig => ({
  primaryTopicIds: payload.primaryTopicIds,
  secondaryTopicIds: payload.secondaryTopicIds,
  excludedTopicIds: payload.excludedTopicIds,
  difficultyDistribution: payload.difficultyDistribution,
  reasoningDistribution: payload.reasoningDistribution,
  reasoningData: payload.reasoningData
});

export const assessmentService = {
  async getAssessments(options: GetAssessmentsOptions = {}): Promise<Assessment[]> {
    const params: Record<string, number> = {};
    if (options.courseId) {
      params.courseId = options.courseId;
    }

    const response = await api.get('/api/assessments', {
      params: Object.keys(params).length ? params : undefined
    });
    return response.data.data || [];
  },

  async createAssessment(payload: AssessmentGenerationParams): Promise<Assessment> {
    const response = await api.post('/api/assessments', {
      type: payload.type,
      name: payload.name,
      semester: payload.semester,
      description: payload.description,
      courseId: payload.courseId,
      blueprintConfig: toBlueprintConfig(payload)
    });

    return response.data.data;
  },

  async getAssessment(id: number): Promise<Assessment> {
    const response = await api.get(`/api/assessments/${id}`);
    return response.data.data;
  },

  async getAssessmentSections(assessmentId: number): Promise<AssessmentSection[]> {
    const response = await api.get(`/api/assessments/${assessmentId}/sections`);
    return response.data.data || [];
  },

  async createSection(assessmentId: number, payload: AssessmentSectionCreateInput): Promise<AssessmentSection> {
    const response = await api.post(`/api/assessments/${assessmentId}/sections`, payload);
    return response.data.data;
  },

  async updateSection(
    assessmentId: number,
    sectionId: number,
    payload: Partial<AssessmentSectionCreateInput>
  ): Promise<AssessmentSection> {
    const response = await api.put(`/api/assessments/${assessmentId}/sections/${sectionId}`, payload);
    return response.data.data;
  },

  async deleteSection(assessmentId: number, sectionId: number): Promise<void> {
    await api.delete(`/api/assessments/${assessmentId}/sections/${sectionId}`);
  },

  async deleteAssessment(assessmentId: number): Promise<void> {
    await api.delete(`/api/assessments/${assessmentId}`);
  },

  async addVariantToSection(
    assessmentId: number,
    sectionId: number,
    payload: { variantId: number; displayOrder?: number; metadata?: Record<string, unknown> }
  ): Promise<SectionVariantLink> {
    const response = await api.post(
      `/api/assessments/${assessmentId}/sections/${sectionId}/variants`,
      payload
    );
    return response.data.data;
  },

  async removeVariantFromSection(
    assessmentId: number,
    sectionId: number,
    variantId: number
  ): Promise<void> {
    await api.delete(
      `/api/assessments/${assessmentId}/sections/${sectionId}/variants/${variantId}`
    );
  }
};

export default assessmentService;
