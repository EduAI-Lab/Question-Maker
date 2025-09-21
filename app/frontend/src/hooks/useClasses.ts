import { useState, useEffect, useCallback } from 'react';
import { Class, ClassCreate } from '../types/class';
import { classService } from '../services/classService';

export const useClasses = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClasses = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await classService.getClasses();
      setClasses(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch classes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createClass = useCallback(async (classData: ClassCreate) => {
    try {
      const newClass = await classService.createClass(classData);
      setClasses(prev => [newClass, ...prev]);
      return { success: true, data: newClass };
    } catch (err: any) {
      return { 
        success: false, 
        error: err.response?.data?.error || 'Failed to create class' 
      };
    }
  }, []);

  const updateClass = useCallback(async (id: number, classData: Partial<ClassCreate>) => {
    try {
      const updatedClass = await classService.updateClass(id, classData);
      setClasses(prev => 
        prev.map(c => c.id === id ? updatedClass : c)
      );
      return { success: true, data: updatedClass };
    } catch (err: any) {
      return { 
        success: false, 
        error: err.response?.data?.error || 'Failed to update class' 
      };
    }
  }, []);

  const deleteClass = useCallback(async (id: number) => {
    try {
      await classService.deleteClass(id);
      setClasses(prev => prev.filter(c => c.id !== id));
      return { success: true };
    } catch (err: any) {
      return { 
        success: false, 
        error: err.response?.data?.error || 'Failed to delete class' 
      };
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  return {
    classes,
    isLoading,
    error,
    fetchClasses,
    createClass,
    updateClass,
    deleteClass
  };
};

