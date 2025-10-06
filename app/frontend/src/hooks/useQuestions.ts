import { useState, useEffect, useCallback } from 'react';
import { Question, QuestionCreate, QuestionMetadata, QuestionGenerationParams } from '../types/question';
import { questionService } from '../services/questionService';

export const useQuestions = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(async (options: {
    courseId?: number;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await questionService.getQuestions(options);
      setQuestions(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch questions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createQuestion = useCallback(async (questionData: QuestionCreate) => {
    try {
      const newQuestion = await questionService.createQuestion(questionData);
      setQuestions(prev => [newQuestion, ...prev]);
      return { success: true, data: newQuestion };
    } catch (err: any) {
      return { 
        success: false, 
        error: err.response?.data?.error || 'Failed to create question' 
      };
    }
  }, []);

  const updateQuestion = useCallback(async (id: number, questionData: Partial<QuestionCreate>) => {
    try {
      const updatedQuestion = await questionService.updateQuestion(id, questionData);
      setQuestions(prev => 
        prev.map(q => q.id === id ? updatedQuestion : q)
      );
      return { success: true, data: updatedQuestion };
    } catch (err: any) {
      return { 
        success: false, 
        error: err.response?.data?.error || 'Failed to update question' 
      };
    }
  }, []);

  const deleteQuestion = useCallback(async (id: number) => {
    try {
      await questionService.deleteQuestion(id);
      setQuestions(prev => prev.filter(q => q.id !== id));
      return { success: true };
    } catch (err: any) {
      return { 
        success: false, 
        error: err.response?.data?.error || 'Failed to delete question' 
      };
    }
  }, []);

  const generateQuestions = useCallback(async (params: QuestionGenerationParams) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await questionService.generateQuestions(params);
      return { success: true, data };
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to generate questions';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const approveQuestions = useCallback(async (questions: QuestionMetadata[], courseId?: number) => {
    try {
      const data = await questionService.approveQuestions(questions, courseId);
      setQuestions(prev => [...data, ...prev]);
      return { success: true, data };
    } catch (err: any) {
      return { 
        success: false, 
        error: err.response?.data?.error || 'Failed to approve questions' 
      };
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  return {
    questions,
    isLoading,
    error,
    fetchQuestions,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    generateQuestions,
    approveQuestions
  };
};
