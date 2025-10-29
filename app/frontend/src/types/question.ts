export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionType = 'MCQ' | 'SA';
export type ReasoningLevel = 'factual' | 'analytical' | 'application';
export type AssessmentType = 'Assignment' | 'Lab' | 'Quiz' | 'Mid' | 'Final';

// Question Metadata (matches backend Question_Metadata schema)
export interface QuestionMetadata {
    id: number;
    description: string | null;
    type: QuestionType;
    courseId: number;
    primaryTopicId: number;
    questionOrder: Record<number, number> | null; // Maps assessment IDs to order numbers
    createdAt: string;
    updatedAt: string;
    // Relations
    course?: Course;
    primaryTopic?: Topic;
    variants?: QuestionVariant[];
}

// Question Variant (matches backend Variants schema)
export interface QuestionVariant {
    id: number;
    questionText: string;
    difficulty: QuestionDifficulty;
    reasoningLevel: ReasoningLevel;
    questionMetadataId: number;
    assessmentId: number | null;
    secondaryTopicsId: number[] | null;
    referenceId: number | null;
    answer: string | null;
    createdAt: string;
    updatedAt: string;
    // Relations
    questionMetadata?: QuestionMetadata;
    assessment?: Assessment;
    originalVariant?: QuestionVariant;
    referencedVariants?: QuestionVariant[];
}

// Assessment (matches backend Assessments schema)
export interface Assessment {
    id: number;
    type: AssessmentType;
    name: string;
    semester: string;
    createdAt: string;
    updatedAt: string;
    // Relations
    variants?: QuestionVariant[];
}

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

// Topic (matches backend Topics schema)
export interface Topic {
    id: number;
    name: string;
    courseId: number;
    createdAt: string;
    updatedAt: string;
    // Relations
    course?: Course;
    primaryQuestions?: QuestionMetadata[];
}

// User (matches backend User schema)
export interface User {
    id: number;
    email: string;
    passwordHash: string;
    createdAt: string;
    updatedAt: string;
    // Relations
    courses?: Course[];
}

// Legacy types for backward compatibility (to be removed eventually)
export interface Question {
    id: number;
    content: string;
    difficulty: QuestionDifficulty;
    bloomLevel: string;
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
    content: string;
    difficulty?: QuestionDifficulty;
    bloomLevel?: string;
    classId?: number;
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
    difficultyStats: Array<{
        difficulty: QuestionDifficulty;
        count: number;
    }>;
    bloomLevelStats: Array<{
        bloomLevel: string;
        count: number;
    }>;
}
