/**
 * Routes for the assessment variant workflow (API path `/api/study`): reference marking, blueprint snapshot, assembly, metrics.
 */
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  setAssessmentStudyRole,
  getBlueprintSnapshot,
  getBaselineVariantReadiness,
  assembleEquivalentExamVariants,
  assembleExamVariantsByMetadataSimilarity,
  generateBankVariantsForQuestions
} from '../services/studyExperimentService.js';
import { computeStudyMetrics } from '../services/studyMetricsService.js';

const router = express.Router();

/** PATCH /api/study/assessments/:id/role — set blueprintConfig.studyRole for an assessment. */
router.patch('/assessments/:id/role', authenticateToken, async (req, res, next) => {
  try {
    if (!('studyRole' in req.body)) {
      return res.status(400).json({
        success: false,
        error: 'studyRole is required (string or null to clear)'
      });
    }
    const studyRole = req.body.studyRole;
    const assessment = await setAssessmentStudyRole(Number(req.params.id), req.user.id, studyRole);
    res.json({ success: true, data: assessment });
  } catch (error) {
    next(error);
  }
});

/** GET /api/study/assessments/:id/blueprint-snapshot — ordered slots + aggregates for a reference exam. */
router.get('/assessments/:id/blueprint-snapshot', authenticateToken, async (req, res, next) => {
  try {
    const snapshot = await getBlueprintSnapshot(Number(req.params.id), req.user.id);
    res.json({ success: true, data: snapshot });
  } catch (error) {
    next(error);
  }
});

/** GET /api/study/assessments/:id/variant-readiness?courseId= — non-draft variant counts per base question on baseline. */
router.get('/assessments/:id/variant-readiness', authenticateToken, async (req, res, next) => {
  try {
    const courseId = req.query.courseId;
    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'courseId query parameter is required'
      });
    }
    const data = await getBaselineVariantReadiness(req.user.id, {
      assessmentId: Number(req.params.id),
      courseId: Number(courseId)
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** POST /api/study/assemble-variants — build parallel exams from a reference assessment. */
router.post('/assemble-variants', authenticateToken, async (req, res, next) => {
  try {
    const {
      referenceAssessmentId,
      courseId,
      examLabels,
      namePrefix,
      includeDrafts,
      semesterOverride,
      assessmentTypeOverride
    } = req.body;

    if (!referenceAssessmentId || !courseId) {
      return res.status(400).json({
        success: false,
        error: 'referenceAssessmentId and courseId are required'
      });
    }

    const result = await assembleEquivalentExamVariants(req.user.id, {
      referenceAssessmentId: Number(referenceAssessmentId),
      courseId: Number(courseId),
      examLabels: Array.isArray(examLabels) ? examLabels : undefined,
      namePrefix: typeof namePrefix === 'string' ? namePrefix : null,
      includeDrafts: Boolean(includeDrafts),
      semesterOverride: typeof semesterOverride === 'string' ? semesterOverride : null,
      assessmentTypeOverride: assessmentTypeOverride || null
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/** POST /api/study/assemble-by-metadata — parallel exams using bank questions with similar metadata per slot. */
router.post('/assemble-by-metadata', authenticateToken, async (req, res, next) => {
  try {
    const {
      referenceAssessmentId,
      courseId,
      examLabels,
      namePrefix,
      includeDrafts,
      semesterOverride,
      assessmentTypeOverride
    } = req.body;

    if (!referenceAssessmentId || !courseId) {
      return res.status(400).json({
        success: false,
        error: 'referenceAssessmentId and courseId are required'
      });
    }

    const result = await assembleExamVariantsByMetadataSimilarity(req.user.id, {
      referenceAssessmentId: Number(referenceAssessmentId),
      courseId: Number(courseId),
      examLabels: Array.isArray(examLabels) ? examLabels : undefined,
      namePrefix: typeof namePrefix === 'string' ? namePrefix : null,
      includeDrafts: includeDrafts !== false,
      semesterOverride: typeof semesterOverride === 'string' ? semesterOverride : null,
      assessmentTypeOverride: assessmentTypeOverride || null
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/** POST /api/study/generate-bank-variants — EduAI alternate variants per question id (promotes primary variant). */
router.post('/generate-bank-variants', authenticateToken, async (req, res, next) => {
  try {
    const { questionIds, courseId, model, apiKeys, variantsToAdd, variantPromptInstructions } = req.body;

    if (!courseId || !Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'courseId and questionIds (non-empty array) are required'
      });
    }

    const result = await generateBankVariantsForQuestions(req.user.id, {
      questionIds: questionIds.map(Number),
      courseId: Number(courseId),
      model: typeof model === 'string' ? model : undefined,
      apiKeys: apiKeys && typeof apiKeys === 'object' ? apiKeys : {},
      variantsToAdd: variantsToAdd != null ? Number(variantsToAdd) : 1,
      variantPromptInstructions: typeof variantPromptInstructions === 'string' ? variantPromptInstructions : null
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/** POST /api/study/metrics — pairwise structural similarity and workflow stats. */
router.post('/metrics', authenticateToken, async (req, res, next) => {
  try {
    const { assessmentIds, referenceAssessmentId } = req.body;
    if (!Array.isArray(assessmentIds) || assessmentIds.length < 1) {
      return res.status(400).json({
        success: false,
        error: 'assessmentIds must be a non-empty array'
      });
    }

    const metrics = await computeStudyMetrics(
      assessmentIds.map(Number),
      req.user.id,
      { referenceAssessmentId: referenceAssessmentId ? Number(referenceAssessmentId) : undefined }
    );

    res.json({ success: true, data: metrics });
  } catch (error) {
    next(error);
  }
});

export default router;
