import api from './api';
import { Assessment, AssessmentGenerationParams, AssessmentBlueprintConfig } from '../types/question';

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
  }
};

export default assessmentService;
