export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionType = 'MCQ' | 'SA';
export type ReasoningLevel = 'factual' | 'analytical' | 'application';

export interface QuestionVariant {
  id: number;
  questionText: string;
  difficulty: QuestionDifficulty;
  reasoningLevel: ReasoningLevel;
  answer: string | null;
  assessmentId: number | null;
  secondaryTopicsId: number[];
  referenceId: number | null;
  baseReferenceId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExtractedQuestion {
  id?: string;
  question: string;
  instructions?: string;
  difficulty?: QuestionDifficulty;
  answer?: string | null;
  type?: QuestionType;
  summary?: string;
  primaryTopicId?: number | null;
  secondaryTopicIds?: number[];
  include?: boolean;
}

export interface QuestionVariantEntry {
  questionId: number;
  questionDescription: string;
  questionType: QuestionType;
  primaryTopicId: number;
  primaryTopicName?: string;
  courseId: number;
  courseName?: string;
  courseCode?: string | null;
  secondaryTopicNames?: string[];
  variant: QuestionVariant;
}

export interface SavedExtractedQuestion {
  metadata: Question;
  variant: QuestionVariant;
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
}

export interface QuestionCreate {
  description: string;
  courseId: number;
  primaryTopicId: number;
  type: QuestionType;
  questionOrder?: Record<string, number> | null;
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
  reasoningDistribution: {
    factual: number;
    analytical: number;
    application: number;
  };
}

export interface QuestionStats {
  totalQuestions: number;
  typeStats: Array<{
    type: QuestionType;
    count: number;
  }>;
}
