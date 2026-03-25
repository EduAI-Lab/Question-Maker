/**
 * Assessment variant workflow: mark reference exams, snapshot blueprints, and assemble equivalent variant exams.
 */
import { sequelize } from '../config/database.js';
import {
  Assessments,
  AssessmentSections,
  SectionVariants,
  Variants,
  Question_Metadata,
  Course,
  Topics
} from '../schema/index.js';
import eduaiService from './eduaiService.js';
import { Op } from 'sequelize';
import { loadOrderedVariantsForAssessment, aggregateStructure } from './studyMetricsService.js';

const VALID_STUDY_ROLES = ['reference_baseline', 'generated_variant'];

/** Non-draft variant count per base question required before parallel assembly can swap alternate wording. */
export const MIN_NON_DRAFT_VARIANTS_FOR_WORKFLOW = 2;

/**
 * Per base question on a baseline assessment: non-draft variant counts in the bank and readiness for assembly.
 */
export async function getBaselineVariantReadiness(userId, { assessmentId, courseId }) {
  if (!assessmentId || !courseId) {
    throw new Error('assessmentId and courseId are required');
  }

  const assessment = await Assessments.findOne({
    where: { id: Number(assessmentId), courseId: Number(courseId) },
    include: [
      {
        model: Course,
        as: 'course',
        where: { userId },
        attributes: ['id'],
        required: true
      }
    ]
  });

  if (!assessment) {
    throw new Error('Assessment not found or course mismatch');
  }

  const orderedVariants = await loadOrderedVariantsForAssessment(assessment.id);
  const seenMeta = new Set();
  const slots = [];

  for (const v of orderedVariants) {
    const mid = v.questionMetadata?.id;
    if (mid == null || seenMeta.has(mid)) continue;
    seenMeta.add(mid);

    const metaRow = await Question_Metadata.findOne({
      where: { id: mid, courseId: Number(courseId) },
      attributes: ['id']
    });
    if (!metaRow) continue;

    const nonDraftVariantCount = await Variants.count({
      where: { questionMetadataId: mid, isDraft: false }
    });

    slots.push({
      order: slots.length + 1,
      questionMetadataId: mid,
      description: v.questionMetadata?.description ?? null,
      questionType: v.questionMetadata?.type ?? null,
      nonDraftVariantCount,
      ready: nonDraftVariantCount >= MIN_NON_DRAFT_VARIANTS_FOR_WORKFLOW
    });
  }

  return {
    assessmentId: assessment.id,
    courseId: assessment.courseId,
    minRequiredNonDraft: MIN_NON_DRAFT_VARIANTS_FOR_WORKFLOW,
    slots,
    allReady: slots.length > 0 && slots.every((s) => s.ready)
  };
}

/** Merges `studyRole` into assessment.blueprintConfig (JSONB). */
export async function setAssessmentStudyRole(assessmentId, userId, studyRole) {
  if (studyRole !== null && studyRole !== undefined && !VALID_STUDY_ROLES.includes(studyRole)) {
    throw new Error('Invalid studyRole');
  }

  const assessment = await Assessments.findOne({
    where: { id: assessmentId },
    include: [
      {
        model: Course,
        as: 'course',
        where: { userId },
        attributes: ['id'],
        required: true
      }
    ]
  });

  if (!assessment) {
    throw new Error('Assessment not found');
  }

  const prev = assessment.blueprintConfig || {};
  const next = { ...prev };
  if (studyRole === null || studyRole === undefined) {
    delete next.studyRole;
  } else {
    next.studyRole = studyRole;
  }

  await assessment.update({ blueprintConfig: Object.keys(next).length ? next : null });
  return assessment;
}

/**
 * Ordered slots from a reference assessment: one entry per placed variant.
 */
export async function getBlueprintSnapshot(assessmentId, userId) {
  const assessment = await Assessments.findOne({
    where: { id: assessmentId },
    include: [
      {
        model: Course,
        as: 'course',
        where: { userId },
        attributes: ['id', 'name', 'code'],
        required: true
      }
    ]
  });

  if (!assessment) {
    throw new Error('Assessment not found');
  }

  const variants = await loadOrderedVariantsForAssessment(assessmentId);
  const slots = variants.map((v, index) => ({
    order: index + 1,
    variantId: v.id,
    questionMetadataId: v.questionMetadata?.id ?? null,
    questionType: v.questionMetadata?.type ?? null,
    primaryTopicId: v.questionMetadata?.primaryTopicId ?? null,
    difficulty: v.difficulty,
    reasoningLevel: v.reasoningLevel
  }));

  const structure = aggregateStructure(variants);

  return {
    assessmentId: assessment.id,
    courseId: assessment.courseId,
    name: assessment.name,
    semester: assessment.semester,
    type: assessment.type,
    studyRole: assessment.blueprintConfig?.studyRole ?? null,
    slotCount: slots.length,
    slots,
    aggregates: {
      topicCounts: structure.topicCounts,
      difficultyCounts: structure.difficultyCounts,
      typeCounts: structure.typeCounts,
      baseQuestionIds: structure.baseQuestionIds
    }
  };
}

/**
 * Picks a variant id for `questionMetadataId`, avoiding ids in `excludeIds`, preferring not `avoidVariantId`.
 */
async function pickVariantForSlot({
  questionMetadataId,
  courseId,
  excludeIds,
  avoidVariantId,
  includeDrafts
}) {
  const where = {
    questionMetadataId
  };
  if (!includeDrafts) {
    where.isDraft = false;
  }

  if (excludeIds.length > 0) {
    where.id = { [Op.notIn]: excludeIds };
  }

  const candidates = await Variants.findAll({
    where,
    include: [
      {
        model: Question_Metadata,
        as: 'questionMetadata',
        where: { courseId },
        attributes: ['id'],
        required: true
      }
    ],
    order: [['id', 'ASC']]
  });

  if (candidates.length === 0) {
    return null;
  }

  const preferred = candidates.filter((c) => c.id !== avoidVariantId);
  const pool = preferred.length > 0 ? preferred : candidates;
  return pool[0].id;
}

/**
 * Creates N parallel exams mirroring the reference order: same base question per slot, different variants when possible.
 */
export async function assembleEquivalentExamVariants(userId, params) {
  const {
    referenceAssessmentId,
    courseId,
    examLabels = ['Exam A', 'Exam B', 'Exam C'],
    namePrefix = null,
    includeDrafts = false,
    semesterOverride = null,
    assessmentTypeOverride = null
  } = params;

  if (!referenceAssessmentId || !courseId) {
    throw new Error('referenceAssessmentId and courseId are required');
  }

  const ref = await Assessments.findOne({
    where: { id: referenceAssessmentId, courseId },
    include: [
      {
        model: Course,
        as: 'course',
        where: { userId },
        attributes: ['id'],
        required: true
      }
    ]
  });

  if (!ref) {
    throw new Error('Reference assessment not found or course mismatch');
  }

  const refVariants = await loadOrderedVariantsForAssessment(referenceAssessmentId);
  if (refVariants.length === 0) {
    throw new Error('Reference assessment has no questions in sections');
  }

  const slots = refVariants.map((v) => ({
    questionMetadataId: v.questionMetadata?.id,
    referenceVariantId: v.id
  }));

  if (slots.some((s) => !s.questionMetadataId)) {
    throw new Error('Every reference variant must have question metadata');
  }

  const started = Date.now();
  const warnings = [];
  const createdAssessments = [];

  const globalUsedVariantIds = new Set();

  await sequelize.transaction(async (t) => {
    for (let examIndex = 0; examIndex < examLabels.length; examIndex++) {
      const label = examLabels[examIndex];
      const baseName = namePrefix?.trim() || ref.name;
      const assessmentName = `${baseName} — ${label}`;

      const assessment = await Assessments.create(
        {
          courseId,
          type: assessmentTypeOverride || ref.type,
          name: assessmentName,
          semester: semesterOverride || ref.semester,
          description: `Assessment variant workflow exam (${label}) from reference assessment #${referenceAssessmentId}`,
          blueprintConfig: {
            studyRole: 'generated_variant',
            referenceAssessmentId: referenceAssessmentId,
            variantLabel: label,
            assembledAt: new Date().toISOString()
          }
        },
        { transaction: t }
      );

      const section = await AssessmentSections.create(
        {
          assessmentId: assessment.id,
          name: 'Exam',
          description: null,
          position: 0
        },
        { transaction: t }
      );

      const excludeForThisExam = new Set(globalUsedVariantIds);

      for (let i = 0; i < slots.length; i++) {
        const { questionMetadataId, referenceVariantId } = slots[i];
        const excludeIds = new Set(excludeForThisExam);
        const picked = await pickVariantForSlot({
          questionMetadataId,
          courseId,
          excludeIds: [...excludeIds],
          avoidVariantId: referenceVariantId,
          includeDrafts
        });

        if (picked == null) {
          throw new Error(
            `No variant available for question metadata ${questionMetadataId} at slot ${i + 1} (need more variants or allow drafts)`
          );
        }

        if (picked === referenceVariantId) {
          warnings.push({
            slot: i + 1,
            questionMetadataId,
            message: 'Reused reference variant text — add more variants for this base question'
          });
        }

        await SectionVariants.create(
          {
            sectionId: section.id,
            variantId: picked,
            displayOrder: i
          },
          { transaction: t }
        );

        await Variants.update(
          { assessmentId: assessment.id },
          { where: { id: picked }, transaction: t }
        );

        excludeForThisExam.add(picked);
        globalUsedVariantIds.add(picked);
      }

      createdAssessments.push(assessment);
    }
  });

  const assemblyTimeMs = Date.now() - started;

  return {
    referenceAssessmentId,
    courseId,
    createdAssessments: createdAssessments.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      semester: a.semester
    })),
    assemblyTimeMs,
    warnings,
    slotsProcessed: slots.length,
    examCount: examLabels.length
  };
}

/** Scores how well a bank question matches a baseline slot (higher = better). */
export function scoreMetadataMatch(slotMeta, slotVariant, bankMeta, bankVariant) {
  let s = 0;
  if (slotMeta?.primaryTopicId != null && bankMeta?.primaryTopicId === slotMeta.primaryTopicId) s += 100;
  if (slotMeta?.type && bankMeta?.type === slotMeta.type) s += 50;
  if (slotVariant?.difficulty && bankVariant?.difficulty === slotVariant.difficulty) s += 25;
  if (slotVariant?.reasoningLevel && bankVariant?.reasoningLevel === slotVariant.reasoningLevel) s += 10;
  return s;
}

const MIN_METADATA_SCORE = 75;

/**
 * Picks the best bank `question_metadata` row for a baseline slot (excluding already-used base ids).
 */
export async function findBestBankMetadataForSlot(slotVariant, courseId, usedBankMetadataIds) {
  const slotMeta = slotVariant.questionMetadata;
  if (!slotMeta) return null;

  const bankRows = await Question_Metadata.findAll({
    where: { courseId },
    include: [
      {
        model: Variants,
        as: 'variants',
        required: true,
        separate: true,
        order: [['id', 'ASC']]
      }
    ]
  });

  let best = null;
  let bestScore = -1;

  for (const bankMeta of bankRows) {
    if (usedBankMetadataIds.has(bankMeta.id)) continue;
    const rep =
      bankMeta.variants?.find((v) => !v.isDraft) || bankMeta.variants?.[0];
    if (!rep) continue;
    const score = scoreMetadataMatch(slotMeta, slotVariant, bankMeta, rep);
    if (score > bestScore) {
      bestScore = score;
      best = { bankMeta, score };
    }
  }

  if (!best || best.score < MIN_METADATA_SCORE) {
    return null;
  }
  return { questionMetadataId: best.bankMeta.id, score: best.score };
}

/**
 * Like `assembleEquivalentExamVariants`, but each slot uses the best bank question by metadata similarity
 * (topic, type, difficulty, reasoning), not necessarily the same `question_metadata` as the baseline row.
 */
export async function assembleExamVariantsByMetadataSimilarity(userId, params) {
  const {
    referenceAssessmentId,
    courseId,
    examLabels = ['Exam A', 'Exam B', 'Exam C'],
    namePrefix = null,
    includeDrafts = true,
    semesterOverride = null,
    assessmentTypeOverride = null
  } = params;

  if (!referenceAssessmentId || !courseId) {
    throw new Error('referenceAssessmentId and courseId are required');
  }

  const ref = await Assessments.findOne({
    where: { id: referenceAssessmentId, courseId },
    include: [
      {
        model: Course,
        as: 'course',
        where: { userId },
        attributes: ['id'],
        required: true
      }
    ]
  });

  if (!ref) {
    throw new Error('Reference assessment not found or course mismatch');
  }

  const refVariants = await loadOrderedVariantsForAssessment(referenceAssessmentId);
  if (refVariants.length === 0) {
    throw new Error('Reference assessment has no questions in sections');
  }

  const started = Date.now();
  const warnings = [];
  const createdAssessments = [];
  const globalUsedVariantIds = new Set();
  const usedBankMetadataIds = new Set();

  await sequelize.transaction(async (t) => {
    for (let examIndex = 0; examIndex < examLabels.length; examIndex++) {
      const label = examLabels[examIndex];
      const baseName = namePrefix?.trim() || ref.name;
      const assessmentName = `${baseName} — ${label}`;

      const assessment = await Assessments.create(
        {
          courseId,
          type: assessmentTypeOverride || ref.type,
          name: assessmentName,
          semester: semesterOverride || ref.semester,
          description: `Assessment variant workflow exam (${label}) assembled by metadata similarity from reference #${referenceAssessmentId}`,
          blueprintConfig: {
            studyRole: 'generated_variant',
            referenceAssessmentId: referenceAssessmentId,
            variantLabel: label,
            assemblyMode: 'metadata_similarity',
            assembledAt: new Date().toISOString()
          }
        },
        { transaction: t }
      );

      const section = await AssessmentSections.create(
        {
          assessmentId: assessment.id,
          name: 'Exam',
          description: null,
          position: 0
        },
        { transaction: t }
      );

      const excludeForThisExam = new Set(globalUsedVariantIds);
      usedBankMetadataIds.clear();

      for (let i = 0; i < refVariants.length; i++) {
        const slotVariant = refVariants[i];
        const match = await findBestBankMetadataForSlot(slotVariant, courseId, usedBankMetadataIds);

        if (!match) {
          throw new Error(
            `No bank question met the metadata similarity threshold (>=${MIN_METADATA_SCORE}) for slot ${i + 1}. Add questions with matching topic/type in the bank.`
          );
        }

        usedBankMetadataIds.add(match.questionMetadataId);

        const excludeIds = new Set(excludeForThisExam);
        const picked = await pickVariantForSlot({
          questionMetadataId: match.questionMetadataId,
          courseId,
          excludeIds: [...excludeIds],
          avoidVariantId: slotVariant.id,
          includeDrafts
        });

        if (picked == null) {
          throw new Error(
            `No variant available for matched bank question ${match.questionMetadataId} at slot ${i + 1} (need ≥3 non-draft variants per concept for three exams, or enable drafts).`
          );
        }

        if (picked === slotVariant.id) {
          warnings.push({
            slot: i + 1,
            questionMetadataId: match.questionMetadataId,
            message: 'Reused baseline slot variant id — add more distinct variants in the bank.'
          });
        }

        await SectionVariants.create(
          {
            sectionId: section.id,
            variantId: picked,
            displayOrder: i
          },
          { transaction: t }
        );

        await Variants.update(
          { assessmentId: assessment.id },
          { where: { id: picked }, transaction: t }
        );

        excludeForThisExam.add(picked);
        globalUsedVariantIds.add(picked);
      }

      createdAssessments.push(assessment);
    }
  });

  const assemblyTimeMs = Date.now() - started;

  return {
    referenceAssessmentId,
    courseId,
    assemblyMode: 'metadata_similarity',
    createdAssessments: createdAssessments.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      semester: a.semester
    })),
    assemblyTimeMs,
    warnings,
    slotsProcessed: refVariants.length,
    examCount: examLabels.length
  };
}

function normalizeReasoningLevel(value) {
  if (value === 'analytical' || value === 'application' || value === 'factual') return value;
  return 'factual';
}

/**
 * Promotes the first variant of each question to non-draft, then generates `variantsToAdd` alternate variants via EduAI.
 */
export async function generateBankVariantsForQuestions(userId, params) {
  const {
    questionIds,
    courseId,
    model = 'ollama:gpt-oss:120b',
    apiKeys = {},
    variantsToAdd = 1,
    variantPromptInstructions = null
  } = params;

  let extraInstructions = '';
  if (variantPromptInstructions != null && String(variantPromptInstructions).trim()) {
    const trimmed = String(variantPromptInstructions).trim().slice(0, 4000);
    extraInstructions = `\n\nAdditional instructions from the instructor (apply to this variant):\n"""\n${trimmed}\n"""\n`;
  }

  if (!courseId || !Array.isArray(questionIds) || questionIds.length === 0) {
    throw new Error('courseId and a non-empty questionIds array are required');
  }

  const course = await Course.findOne({
    where: { id: Number(courseId), userId },
    attributes: ['id', 'code', 'name']
  });

  if (!course) {
    throw new Error('Course not found');
  }

  if (!eduaiService.isConfigured()) {
    throw new Error('EduAI is not configured; cannot generate variants.');
  }

  const rawCode = (course.code && course.code.trim()) || `COURSE-${course.id}`;
  const courseCode = rawCode.replace(/\s+/g, '').toUpperCase();

  const topics = await Topics.findAll({
    where: { courseId: course.id },
    order: [['name', 'ASC']],
    attributes: ['id', 'name']
  });
  const topicLines =
    topics.length > 0 ? topics.map((tp) => `- [${tp.id}] ${tp.name}`).join('\n') : '';

  const results = [];
  const errors = [];

  for (const qid of questionIds) {
    const meta = await Question_Metadata.findOne({
      where: { id: qid, courseId: course.id },
      include: [
        {
          model: Variants,
          as: 'variants',
          separate: true,
          order: [['id', 'ASC']]
        }
      ]
    });

    if (!meta || !meta.variants?.length) {
      errors.push({ questionId: qid, error: 'Question not found or has no variants' });
      continue;
    }

    const primaryVariant = meta.variants[0];
    await primaryVariant.update({ isDraft: false });

    const createdVariantIds = [];

    for (let n = 0; n < variantsToAdd; n++) {
      const difficultyDistribution = {
        easy: primaryVariant.difficulty === 'easy' ? 1 : 0,
        medium: primaryVariant.difficulty === 'medium' ? 1 : 0,
        hard: primaryVariant.difficulty === 'hard' ? 1 : 0
      };
      const rl = primaryVariant.reasoningLevel || 'factual';
      const reasoningDistribution = {
        factual: rl === 'factual' ? 100 : 0,
        analytical: rl === 'analytical' ? 100 : 0,
        application: rl === 'application' ? 100 : 0
      };

      const prompt = `Create ONE alternate assessment variant of the following question. Preserve the same learning objective and approximate difficulty, but change surface details (values, scenario names, wording) so the item is not identical to the original.

Original type: ${meta.type}
Original question text:
"""
${primaryVariant.questionText}
"""

${topicLines ? `Course topics (use numeric IDs in output when applicable):\n${topicLines}\n` : ''}${extraInstructions}
Return exactly one question in the required JSON format.`;

      try {
        const generated = await eduaiService.generateQuestions({
          prompt,
          courseCode,
          model,
          apiKeys,
          numQuestions: 1,
          difficultyDistribution,
          reasoningDistribution
        });

        const q = Array.isArray(generated) ? generated[0] : null;
        if (!q || !q.content) {
          throw new Error('EduAI returned no question content');
        }

        let answer = q.answer ?? null;
        let choices = q.choices ?? null;
        if (meta.type === 'MCQ' && (!choices || choices.length < 2)) {
          throw new Error('MCQ variant missing choices');
        }

        const v = await Variants.create({
          questionMetadataId: meta.id,
          questionText: q.content.trim(),
          difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : primaryVariant.difficulty,
          reasoningLevel: normalizeReasoningLevel(q.reasoning_level),
          answer,
          choices: meta.type === 'MCQ' ? choices : null,
          assessmentId: null,
          secondaryTopicsId: Array.isArray(primaryVariant.secondaryTopicsId)
            ? primaryVariant.secondaryTopicsId
            : [],
          referenceId: primaryVariant.id,
          isAiGenerated: true,
          isDraft: false
        });

        createdVariantIds.push(v.id);
      } catch (err) {
        errors.push({ questionId: qid, iteration: n + 1, error: err.message || String(err) });
        break;
      }
    }

    results.push({
      questionId: qid,
      promotedVariantId: primaryVariant.id,
      createdVariantIds
    });
  }

  return { results, errors, courseId: course.id };
}
