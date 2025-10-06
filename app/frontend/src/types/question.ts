export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
export type QuestionType = 'MCQ' | 'SA';

export interface QuestionVariant {
  id: number;
  questionText: string;
  difficulty: QuestionDifficulty;
  answer: string | null;
  assessmentId: number | null;
  secondaryTopicsId: number[];
  referenceId: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Question {
  id: number;
  description: string;
  type: QuestionType;
  courseId: number;
  primaryTopicId: number;
  questionOrder: Record<string, number> | null;
  createdAt: string;
  updatedAt: string;
  course?: {
    id: number;
    name: string;
    code?: string | null;
  };
  variants?: QuestionVariant[];
  /** Legacy fields maintained for backwards compatibility */
  content?: string;
  difficulty?: QuestionDifficulty;
  bloomLevel?: BloomLevel;
  classId?: number;
  class?: {
    id: number;
    name: string;
    subject?: string;
  };
}

export interface QuestionCreate {
  description: string;
  courseId: number;
  primaryTopicId: number;
  type: QuestionType;
  questionOrder?: Record<string, number> | null;
}

export interface QuestionMetadata {
  content: string;
  difficulty: QuestionDifficulty;
  bloom_level: BloomLevel;
}

export interface QuestionGenerationParams {
  prompt: string;
  provider: 'groq' | 'openai' | 'deepseek';
  numQuestions: number;
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
  };
}

export interface QuestionStats {
  totalQuestions: number;
  typeStats: Array<{
    type: QuestionType;
    count: number;
  }>;
}
