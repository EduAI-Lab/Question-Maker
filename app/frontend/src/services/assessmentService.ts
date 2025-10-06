import api from './api';

export interface AssessmentSummary {
  id: number;
  name: string;
  type: string;
  semester: string;
  courseId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export const assessmentService = {
  async getAssessments(): Promise<AssessmentSummary[]> {
    const response = await api.get('/api/assessments');
    return response.data.data || [];
  }
};
