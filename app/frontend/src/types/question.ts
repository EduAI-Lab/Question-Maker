export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

export interface Question {
  id: number;
  content: string;
  difficulty: QuestionDifficulty;
  bloomLevel: BloomLevel;
  createdAt: string;
  userId: number;
  classId?: number;
  class?: {
    id: number;
    name: string;
    subject: string;
  };
}

export interface QuestionCreate {
  content: string;
  difficulty?: QuestionDifficulty;
  bloomLevel?: BloomLevel;
  classId?: number;
}

export interface QuestionMetadata {
  content: string;
  difficulty: QuestionDifficulty;
  bloom_level: BloomLevel;
}

export interface ExtractedQuestion {
  question: string;
  instructions?: string;
  difficulty?: QuestionDifficulty;
}

export interface SavedExtractedQuestion {
  metadata: {
    id: number;
    description: string | null;
    type: 'MCQ' | 'SA';
    courseId: number;
    primaryTopicId: number;
    questionOrder: number | null;
    createdAt: string;
    updatedAt: string;
  };
  variant: {
    id: number;
    questionText: string;
    difficulty: QuestionDifficulty;
    questionMetadataId: number;
    assessmentId: number | null;
    secondaryTopicsId: number | null;
    referenceId: number | null;
    answer: string | null;
    createdAt: string;
    updatedAt: string;
  };
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
  difficultyStats: Array<{
    difficulty: QuestionDifficulty;
    count: number;
  }>;
  bloomLevelStats: Array<{
    bloomLevel: BloomLevel;
    count: number;
  }>;
}
