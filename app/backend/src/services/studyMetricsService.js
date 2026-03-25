/**
 * Metrics for comparing exam/assessment structure (topics, difficulty, type) and workflow stats.
 * Jensen–Shannon similarity and Jaccard are defined for the assessment variant workflow metrics.
 */
import {
  Assessments,
  AssessmentSections,
  SectionVariants,
  Variants,
  Question_Metadata,
  Topics,
  Course
} from '../schema/index.js';
import { Op } from 'sequelize';

const DIFFICULTY_KEYS = ['easy', 'medium', 'hard'];
const TYPE_KEYS = ['MCQ', 'SA', 'LA'];

/** Builds a normalized probability vector over `keys` from count record. */
export function countsToDistribution(counts, keys) {
  const total = keys.reduce((sum, k) => sum + (counts[k] ?? 0), 0);
  if (total === 0) {
    const uniform = 1 / keys.length;
    const out = {};
    keys.forEach((k) => {
      out[k] = uniform;
    });
    return out;
  }
  const out = {};
  keys.forEach((k) => {
    out[k] = (counts[k] ?? 0) / total;
  });
  return out;
}

/** Natural log helper. */
function log2(x) {
  return Math.log(x) / Math.LN2;
}

/** Kullback–Leibler divergence D_KL(P || Q) for aligned keys; 0 log 0 := 0. */
export function klDivergence(p, q, keys) {
  let sum = 0;
  for (const k of keys) {
    const pk = p[k] ?? 0;
    const qk = q[k] ?? 0;
    if (pk > 0) {
      if (qk <= 0) return Infinity;
      sum += pk * log2(pk / qk);
    }
  }
  return sum;
}

/** Jensen–Shannon divergence (base 2) between discrete distributions P and Q over `keys`. */
export function jensenShannonDivergence(pCounts, qCounts, keys) {
  const p = countsToDistribution(pCounts, keys);
  const q = countsToDistribution(qCounts, keys);
  const m = {};
  for (const k of keys) {
    m[k] = 0.5 * ((p[k] ?? 0) + (q[k] ?? 0));
  }
  return 0.5 * klDivergence(p, m, keys) + 0.5 * klDivergence(q, m, keys);
}

/** Returns 1 − JSD as similarity in [0, 1] (1 = identical distributions). */
export function distributionSimilarity(pCounts, qCounts, keys) {
  const jsd = jensenShannonDivergence(pCounts, qCounts, keys);
  return Math.max(0, 1 - jsd);
}

/** Jaccard similarity for two sets of ids. */
export function jaccardSimilarity(setA, setB) {
  const a = new Set(setA);
  const b = new Set(setB);
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter += 1;
  }
  const union = a.size + b.size - inter;
  if (union === 0) return 1;
  return inter / union;
}

/** Loads ordered variant rows for an assessment (all sections, section position then display order). */
export async function loadOrderedVariantsForAssessment(assessmentId) {
  const sections = await AssessmentSections.findAll({
    where: { assessmentId },
    order: [['position', 'ASC'], ['id', 'ASC']],
    include: [
      {
        model: SectionVariants,
        as: 'sectionVariants',
        separate: true,
        order: [['displayOrder', 'ASC'], ['id', 'ASC']],
        include: [
          {
            model: Variants,
            as: 'variant',
            attributes: [
              'id',
              'difficulty',
              'reasoningLevel',
              'questionMetadataId',
              'isAiGenerated',
              'isDraft'
            ],
            include: [
              {
                model: Question_Metadata,
                as: 'questionMetadata',
                attributes: ['id', 'type', 'primaryTopicId', 'description']
              }
            ]
          }
        ]
      }
    ]
  });

  const ordered = [];
  for (const section of sections) {
    const links = section.sectionVariants || [];
    for (const link of links) {
      if (link.variant) ordered.push(link.variant);
    }
  }
  return ordered;
}

/** Aggregates topic / difficulty / type counts from variant rows (topic keys are strings). */
export function aggregateStructure(variants, topicKeyFn = (v) => v.questionMetadata?.primaryTopicId) {
  const topicCounts = {};
  const difficultyCounts = { easy: 0, medium: 0, hard: 0 };
  const typeCounts = { MCQ: 0, SA: 0, LA: 0 };
  const baseQuestionIds = [];

  for (const v of variants) {
    const meta = v.questionMetadata;
    if (!meta) continue;
    const tid = topicKeyFn(v);
    if (tid != null) {
      const key = String(tid);
      topicCounts[key] = (topicCounts[key] ?? 0) + 1;
    }
    if (difficultyCounts[v.difficulty] !== undefined) {
      difficultyCounts[v.difficulty] += 1;
    }
    if (typeCounts[meta.type] !== undefined) {
      typeCounts[meta.type] += 1;
    }
    baseQuestionIds.push(meta.id);
  }

  return { topicCounts, difficultyCounts, typeCounts, baseQuestionIds, n: variants.length };
}

/** Resolves topic ids to names for reporting. */
async function topicNamesByIds(courseId, topicIds) {
  if (topicIds.length === 0) return {};
  const rows = await Topics.findAll({
    where: { courseId, id: { [Op.in]: topicIds } },
    attributes: ['id', 'name']
  });
  const map = {};
  rows.forEach((t) => {
    map[t.id] = t.name;
  });
  return map;
}

/** Verifies assessment belongs to user via course. */
async function assertAssessmentOwned(assessmentId, userId) {
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
  return assessment;
}

/**
 * Full comparison between two assessments: distribution similarities + Jaccard on base question ids.
 */
export async function compareTwoAssessments(assessmentIdA, assessmentIdB, userId) {
  await assertAssessmentOwned(assessmentIdA, userId);
  await assertAssessmentOwned(assessmentIdB, userId);

  const [va, vb] = await Promise.all([
    loadOrderedVariantsForAssessment(assessmentIdA),
    loadOrderedVariantsForAssessment(assessmentIdB)
  ]);

  const aggA = aggregateStructure(va);
  const aggB = aggregateStructure(vb);

  const topicKeys = [
    ...new Set([...Object.keys(aggA.topicCounts), ...Object.keys(aggB.topicCounts)])
  ];

  const topicSim =
    topicKeys.length === 0
      ? 1
      : distributionSimilarity(
          Object.fromEntries(topicKeys.map((k) => [k, aggA.topicCounts[k] ?? 0])),
          Object.fromEntries(topicKeys.map((k) => [k, aggB.topicCounts[k] ?? 0])),
          topicKeys
        );

  const difficultySim = distributionSimilarity(aggA.difficultyCounts, aggB.difficultyCounts, DIFFICULTY_KEYS);
  const typeSim = distributionSimilarity(aggA.typeCounts, aggB.typeCounts, TYPE_KEYS);
  const jaccardBase = jaccardSimilarity(aggA.baseQuestionIds, aggB.baseQuestionIds);

  const variantIdsA = new Set(va.map((v) => v.id));
  const variantIdsB = new Set(vb.map((v) => v.id));
  let overlap = 0;
  for (const id of variantIdsA) {
    if (variantIdsB.has(id)) overlap += 1;
  }

  return {
    assessmentIdA,
    assessmentIdB,
    nQuestionsA: aggA.n,
    nQuestionsB: aggB.n,
    topicDistributionSimilarity: topicSim,
    difficultyDistributionSimilarity: difficultySim,
    questionTypeDistributionSimilarity: typeSim,
    baseQuestionJaccard: jaccardBase,
    duplicateVariantCountAcrossPair: overlap,
    aggregates: {
      a: { topicCounts: aggA.topicCounts, difficultyCounts: aggA.difficultyCounts, typeCounts: aggA.typeCounts },
      b: { topicCounts: aggB.topicCounts, difficultyCounts: aggB.difficultyCounts, typeCounts: aggB.typeCounts }
    }
  };
}

/**
 * Pairwise metrics for many assessments + optional workflow stats (reuse, AI counts).
 */
export async function computeStudyMetrics(assessmentIds, userId, options = {}) {
  const ids = [...new Set(assessmentIds.map(Number))].filter((id) => !Number.isNaN(id));
  if (ids.length < 1) {
    throw new Error('At least one assessment id is required');
  }

  for (const id of ids) {
    await assertAssessmentOwned(id, userId);
  }

  const pairs = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push(await compareTwoAssessments(ids[i], ids[j], userId));
    }
  }

  const allVariants = await Promise.all(ids.map((id) => loadOrderedVariantsForAssessment(id)));
  const variantIdToAssessments = new Map();
  ids.forEach((aid, idx) => {
    for (const v of allVariants[idx]) {
      if (!variantIdToAssessments.has(v.id)) {
        variantIdToAssessments.set(v.id, new Set());
      }
      variantIdToAssessments.get(v.id).add(aid);
    }
  });

  let variantsAppearingInMultipleExams = 0;
  const reusedVariantIds = [];
  for (const [vid, aset] of variantIdToAssessments) {
    if (aset.size > 1) {
      variantsAppearingInMultipleExams += 1;
      reusedVariantIds.push(vid);
    }
  }

  let aiVariantUses = 0;
  let totalSlots = 0;
  for (const list of allVariants) {
    for (const v of list) {
      totalSlots += 1;
      if (v.isAiGenerated) aiVariantUses += 1;
    }
  }

  let referenceComparison = null;
  if (options.referenceAssessmentId) {
    const refId = Number(options.referenceAssessmentId);
    await assertAssessmentOwned(refId, userId);
    referenceComparison = {};
    for (const id of ids) {
      if (id === refId) continue;
      referenceComparison[`${refId}_vs_${id}`] = await compareTwoAssessments(refId, id, userId);
    }
  }

  const courseId =
    (await Assessments.findByPk(ids[0], { attributes: ['courseId'] }))?.courseId ?? null;
  const topicIdsForNames = [];
  for (const list of allVariants) {
    for (const v of list) {
      if (v.questionMetadata?.primaryTopicId != null) {
        topicIdsForNames.push(v.questionMetadata.primaryTopicId);
      }
    }
  }
  const topicNames = courseId ? await topicNamesByIds(courseId, [...new Set(topicIdsForNames)]) : {};

  return {
    assessmentIds: ids,
    pairwise: pairs,
    workflow: {
      variantsAppearingInMultipleExams,
      reusedVariantIds,
      totalQuestionPlacements: totalSlots,
      aiGeneratedVariantPlacements: aiVariantUses,
      distinctAssessments: ids.length
    },
    referenceComparison,
    topicNames
  };
}
