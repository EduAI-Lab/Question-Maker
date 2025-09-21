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

