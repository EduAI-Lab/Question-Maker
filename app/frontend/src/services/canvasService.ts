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

export interface CanvasQuiz {
  id: number;
  title: string;
  quiz_type: string;
  published: boolean;
  description?: string;
}

export interface CanvasQuestion {
  id: number;
  question_name: string;
  question_text: string;
  question_type: string;
  position: number;
  answers: Array<{
    id: number;
    answer_text: string;
    answer_weight: number;
  }>;
}

export interface CanvasSkippedQuestion {
  position: number;
  name: string;
  type: string;
  reason: string;
}

export interface CanvasImportResult {
  assessmentId: number;
  assessmentName: string;
  questionsImported: number;
  questionsSkipped?: number;
  skippedQuestions?: CanvasSkippedQuestion[];
  sectionId: number;
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
  },

  /**
   * Get quizzes from a Canvas course
   */
  async getQuizzes(canvasCourseId: number): Promise<CanvasQuiz[]> {
    const response = await api.get(`/api/canvas/courses/${canvasCourseId}/quizzes`);
    return response.data.data || [];
  },

  /**
   * Get questions from a Canvas quiz
   */
  async getQuizQuestions(canvasCourseId: number, quizId: number): Promise<CanvasQuestion[]> {
    const response = await api.get(`/api/canvas/courses/${canvasCourseId}/quizzes/${quizId}/questions`);
    return response.data.data || [];
  },

  /**
   * Import a Canvas quiz as an assessment
   */
  async importQuiz(
    canvasCourseId: number,
    quizId: number,
    localCourseId: number,
    options: {
      assessmentType?: string;
      assessmentName?: string;
      semester?: string;
      primaryTopicId: number;
    }
  ): Promise<CanvasImportResult> {
    const response = await api.post(`/api/canvas/import/${canvasCourseId}/quizzes/${quizId}`, {
      localCourseId,
      ...options
    });
    return response.data.data;
  }
};

export default canvasService;

