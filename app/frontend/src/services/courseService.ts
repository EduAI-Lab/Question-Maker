import api from './api';
import { Class, ClassCreate } from '../types/class';
import { Topic } from '../types/topic';

export const courseService = {
  async getCourses(): Promise<Class[]> {
    const response = await api.get('/api/course');
    return response.data.data;
  },

  async getCourse(id: number): Promise<Class> {
    const response = await api.get(`/api/course/${id}`);
    return response.data.data;
  },

  async createCourse(courseData: ClassCreate): Promise<Class> {
    const response = await api.post('/api/course', courseData);
    return response.data.data;
  },

  async updateCourse(id: number, courseData: Partial<ClassCreate>): Promise<Class> {
    const response = await api.put(`/api/course/${id}`, courseData);
    return response.data.data;
  },

  async deleteCourse(id: number): Promise<void> {
    await api.delete(`/api/course/${id}`);
  },

  async getCourseTopics(courseId: number): Promise<Topic[]> {
    const response = await api.get(`/api/course/${courseId}/topics`);
    return response.data.data;
  }
};
