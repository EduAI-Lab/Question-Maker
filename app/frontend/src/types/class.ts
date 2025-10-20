// Import types from question.ts to avoid circular dependencies
import { User, Topic, QuestionMetadata } from './question';

// Course (matches backend Course schema)
export interface Course {
  id: number;
  name: string;
  code: string | null;
  userId: number;
  createdAt: string;
  updatedAt: string;
  // Relations
  user?: User;
  topics?: Topic[];
  questionMetadata?: QuestionMetadata[];
}

export interface CourseCreate {
  name: string;
  code?: string;
}

// Legacy Class interface for backward compatibility (to be removed eventually)
export interface Class {
  id: number;
  name: string;
  subject: string;
  courseCode?: string;
  code?: string | null;
  semester?: string;
  year?: number;
  description?: string;
  department?: string;
  createdAt: string;
  userId: number;
}

export interface ClassCreate {
  name: string;
  subject: string;
  courseCode?: string;
  semester?: string;
  year?: number;
  description?: string;
  department?: string;
}
