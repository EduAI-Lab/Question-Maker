/**
 * API client for the assessment variant workflow (reference exams, assembly, metrics). Routes remain under `/api/study`.
 */
import api from './api';
import { apiKeyStorage } from './apiKeyStorage';

export type StudyRole = 'reference_baseline' | 'generated_variant' | null;

export interface BlueprintSlot {
  order: number;
  variantId: number;
  questionMetadataId: number | null;
  questionType: string | null;
  primaryTopicId: number | null;
  difficulty: string;
  reasoningLevel?: string;
}

export interface BlueprintSnapshot {
  assessmentId: number;
  courseId: number | null;
  name: string;
  semester: string;
  type: string;
  studyRole: StudyRole;
  slotCount: number;
  slots: BlueprintSlot[];
  aggregates: {
    topicCounts: Record<string, number>;
    difficultyCounts: Record<string, number>;
    typeCounts: Record<string, number>;
    baseQuestionIds: number[];
  };
}

export interface AssembleVariantsResult {
  referenceAssessmentId: number;
  courseId: number;
  assemblyMode?: 'metadata_similarity';
  createdAssessments: Array<{ id: number; name: string; type: string; semester: string }>;
  assemblyTimeMs: number;
  warnings: Array<{ slot: number; questionMetadataId: number; message: string }>;
  slotsProcessed: number;
  examCount: number;
}

export interface GenerateBankVariantsResult {
  results: Array<{ questionId: number; promotedVariantId: number; createdVariantIds: number[] }>;
  errors: Array<{ questionId: number; iteration?: number; error: string }>;
  courseId: number;
}

export interface StudyMetricsResult {
  assessmentIds: number[];
  pairwise: unknown[];
  workflow: {
    variantsAppearingInMultipleExams: number;
    reusedVariantIds: number[];
    totalQuestionPlacements: number;
    aiGeneratedVariantPlacements: number;
    distinctAssessments: number;
  };
  referenceComparison: Record<string, unknown> | null;
  topicNames: Record<number, string>;
}

export const studyService = {
  async setStudyRole(assessmentId: number, studyRole: StudyRole): Promise<{ blueprintConfig?: unknown }> {
    const response = await api.patch(`/api/study/assessments/${assessmentId}/role`, { studyRole });
    return response.data.data;
  },

  async getBlueprintSnapshot(assessmentId: number): Promise<BlueprintSnapshot> {
    const response = await api.get(`/api/study/assessments/${assessmentId}/blueprint-snapshot`);
    return response.data.data;
  },

  async assembleEquivalentExams(payload: {
    referenceAssessmentId: number;
    courseId: number;
    examLabels?: string[];
    namePrefix?: string;
    includeDrafts?: boolean;
    semesterOverride?: string;
    assessmentTypeOverride?: string;
  }): Promise<AssembleVariantsResult> {
    const response = await api.post('/api/study/assemble-variants', payload);
    return response.data.data;
  },

  /** Parallel exams: each baseline slot matched to the best bank question by topic/type/difficulty/reasoning score. */
  async assembleExamsByMetadataSimilarity(payload: {
    referenceAssessmentId: number;
    courseId: number;
    examLabels?: string[];
    namePrefix?: string;
    includeDrafts?: boolean;
    semesterOverride?: string;
    assessmentTypeOverride?: string;
  }): Promise<AssembleVariantsResult> {
    const response = await api.post('/api/study/assemble-by-metadata', payload);
    return response.data.data;
  },

  /** After bank OCR save: promote each primary variant and generate N alternate variants via EduAI. */
  async generateBankVariants(payload: {
    courseId: number;
    questionIds: number[];
    model?: string;
    variantsToAdd?: number;
  }): Promise<GenerateBankVariantsResult> {
    const model = payload.model ?? 'ollama:gpt-oss:120b';
    const apiKeys = await apiKeyStorage.buildApiKeysForModel(model);
    const response = await api.post('/api/study/generate-bank-variants', {
      ...payload,
      model,
      apiKeys
    });
    return response.data.data;
  },

  async computeMetrics(assessmentIds: number[], referenceAssessmentId?: number): Promise<StudyMetricsResult> {
    const response = await api.post('/api/study/metrics', {
      assessmentIds,
      referenceAssessmentId
    });
    return response.data.data;
  }
};

export default studyService;
