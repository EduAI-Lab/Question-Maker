import api from './api';
import { Class, ClassCreate } from '../types/class';

export const classService = {
  async getClasses(): Promise<Class[]> {
    const response = await api.get('/api/classes');
    return response.data.data;
  },

  async getClass(id: number): Promise<Class> {
    const response = await api.get(`/api/classes/${id}`);
    return response.data.data;
  },

  async createClass(classData: ClassCreate): Promise<Class> {
    const response = await api.post('/api/classes', classData);
    return response.data.data;
  },

  async updateClass(id: number, classData: Partial<ClassCreate>): Promise<Class> {
    const response = await api.put(`/api/classes/${id}`, classData);
    return response.data.data;
  },

  async deleteClass(id: number): Promise<void> {
    await api.delete(`/api/classes/${id}`);
  }
};

