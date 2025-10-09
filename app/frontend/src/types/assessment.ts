// Import types from question.ts to avoid circular dependencies
import { Assessment, AssessmentType, QuestionVariant } from './question';

// Re-export Assessment types for convenience
export { Assessment, AssessmentType, QuestionVariant };

// Assessment creation interface
export interface AssessmentCreate {
  type: AssessmentType;
  name: string;
  semester: string;
}

// Assessment with questions interface
export interface AssessmentWithQuestions extends Assessment {
  questions: QuestionVariant[];
}

// Legacy Course interface for backward compatibility (to be removed eventually)
export interface Course {
  id: number;
  name: string;
  code: string;
  subject: string;
  semester: string;
  year: number;
}
