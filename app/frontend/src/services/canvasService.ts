import api from './api';

export interface CanvasIntegration {
  canvasUrl: string;
  isTestMode: boolean;
  isConnected: boolean;
}

export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
}

export interface CanvasExportResult {
  quizId: number;
  quizTitle: string;
  questionsCreated: number;
  canvasUrl: string;
}

export const canvasService = {
  /**
   * Get Canvas integration status
   */
  async getIntegration(): Promise<CanvasIntegration | null> {
    try {
      const response = await api.get('/api/canvas/integration');
      return response.data.data;
    } catch (error) {
      console.error('Failed to get Canvas integration:', error);
      return null;
    }
  },

  /**
   * Connect Canvas account
   */
  async connectCanvas(canvasUrl: string, apiKey: string, isTestMode: boolean = false): Promise<CanvasIntegration> {
    const response = await api.post('/api/canvas/connect', {
      canvasUrl,
      apiKey,
      isTestMode
    });
    return response.data.data;
  },

  /**
   * Disconnect Canvas account
   */
  async disconnectCanvas(): Promise<void> {
    await api.delete('/api/canvas/disconnect');
  },

  /**
   * Get user's Canvas courses
   */
  async getCourses(): Promise<CanvasCourse[]> {
    const response = await api.get('/api/canvas/courses');
    return response.data.data || [];
  },

  /**
   * Export assessment to Canvas
   */
  async exportAssessment(assessmentId: number, canvasCourseId: number): Promise<CanvasExportResult> {
    const response = await api.post(`/api/canvas/export/${assessmentId}`, {
      canvasCourseId
    });
    return response.data.data;
  },

  /**
   * Get Canvas course mapping for a local course
   */
  async getCourseMapping(courseId: number) {
    try {
      const response = await api.get(`/api/canvas/mapping/${courseId}`);
      return response.data.data;
    } catch (error) {
      return null;
    }
  }
};

export default canvasService;

