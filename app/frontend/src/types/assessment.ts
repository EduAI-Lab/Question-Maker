// Import types from question.ts to avoid circular dependencies
import { Assessment, AssessmentType, QuestionVariant } from './question';

export { Assessment, AssessmentType, QuestionVariant };

export interface AssessmentCreate {
  type: AssessmentType;
  name: string;
  semester: string;
}

export interface AssessmentWithQuestions extends Assessment {
  questions: QuestionVariant[];
}
