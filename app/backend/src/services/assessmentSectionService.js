import { Assessments, AssessmentSections, SectionVariants, Variants, Question_Metadata, Course } from '../schema/index.js';

const findAssessmentForUser = async (assessmentId, userId) => {
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
};

const findSectionForUser = async (sectionId, userId) => {
  const section = await AssessmentSections.findOne({
    where: { id: sectionId },
    include: [
      {
        model: Assessments,
        as: 'assessment',
        include: [
          {
            model: Course,
            as: 'course',
            where: { userId },
            attributes: ['id']
          }
        ]
      }
    ]
  });

  if (!section) {
    throw new Error('Section not found');
  }

  return section;
};

export const getSectionsForAssessment = async (assessmentId, userId) => {
  await findAssessmentForUser(assessmentId, userId);

  const sections = await AssessmentSections.findAll({
    where: { assessmentId },
    order: [['position', 'ASC'], ['id', 'ASC']],
    include: [
      {
        model: SectionVariants,
        as: 'sectionVariants',
        order: [['displayOrder', 'ASC']],
        include: [
          {
            model: Variants,
            as: 'variant',
            include: [
              {
                model: Question_Metadata,
                as: 'questionMetadata',
                attributes: ['id', 'description', 'type', 'questionOrder', 'isDraft'],
                include: [
                  {
                    model: Course,
                    as: 'course',
                    attributes: ['id', 'name', 'code']
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  });

  return sections;
};

export const createAssessmentSection = async (assessmentId, userId, payload) => {
  const assessment = await findAssessmentForUser(assessmentId, userId);

  const position = payload.position ?? await AssessmentSections.count({ where: { assessmentId } });

  const section = await AssessmentSections.create({
    assessmentId: assessment.id,
    name: payload.name?.trim() || 'Untitled Section',
    description: payload.description?.trim() || null,
    sectionType: payload.sectionType || null,
    difficultySettings: payload.difficultySettings || null,
    topicFilters: payload.topicFilters || null,
    metadata: payload.metadata || null,
    position
  });

  return section;
};

export const updateAssessmentSection = async (sectionId, userId, updates) => {
  const section = await findSectionForUser(sectionId, userId);

  await section.update({
    ...(updates.name !== undefined && { name: updates.name?.trim() || section.name }),
    ...(updates.description !== undefined && { description: updates.description?.trim() || null }),
    ...(updates.sectionType !== undefined && { sectionType: updates.sectionType }),
    ...(updates.difficultySettings !== undefined && { difficultySettings: updates.difficultySettings }),
    ...(updates.topicFilters !== undefined && { topicFilters: updates.topicFilters }),
    ...(updates.metadata !== undefined && { metadata: updates.metadata }),
    ...(updates.position !== undefined && { position: updates.position })
  });

  return section;
};

export const deleteAssessmentSection = async (sectionId, userId) => {
  const section = await findSectionForUser(sectionId, userId);
  await section.destroy();
  return true;
};

const verifyVariantOwnership = async (variantId, userId) => {
  const variant = await Variants.findOne({
    where: { id: variantId },
    include: [
      {
        model: Question_Metadata,
        as: 'questionMetadata',
        include: [
          {
            model: Course,
            as: 'course',
            where: { userId },
            attributes: ['id']
          }
        ]
      }
    ]
  });

  if (!variant) {
    throw new Error('Variant not found');
  }

  return variant;
};

export const addVariantToSection = async (sectionId, userId, variantId, options = {}) => {
  await findSectionForUser(sectionId, userId);
  await verifyVariantOwnership(variantId, userId);

  const displayOrder = options.displayOrder ?? await SectionVariants.count({ where: { sectionId } });

  const link = await SectionVariants.create({
    sectionId,
    variantId,
    displayOrder,
    metadata: options.metadata || null
  });

  return link;
};

export const removeVariantFromSection = async (sectionId, userId, variantId) => {
  await findSectionForUser(sectionId, userId);

  const deleted = await SectionVariants.destroy({
    where: { sectionId, variantId }
  });

  if (!deleted) {
    throw new Error('Variant not found in section');
  }

  return true;
};

export const updateVariantOrderInSection = async (sectionId, userId, variantId, displayOrder) => {
  await findSectionForUser(sectionId, userId);

  const link = await SectionVariants.findOne({
    where: { sectionId, variantId }
  });

  if (!link) {
    throw new Error('Variant not found in section');
  }

  link.displayOrder = displayOrder;
  await link.save();

  return link;
};

/**
 * Check if a question is linked to any assessment sections
 * @param {number} questionId - The question metadata ID
 * @param {number} userId - The user ID for authorization
 * @returns {Promise<{isInAssessments: boolean, assessmentIds: number[]}>} - Whether question is in assessments and which assessment IDs
 */
export const checkQuestionInAssessments = async (questionId, userId) => {
  // Verify user owns the question
  const question = await Question_Metadata.findOne({
    where: { id: questionId },
    include: [
      {
        model: Course,
        as: 'course',
        where: { userId },
        attributes: ['id']
      }
    ]
  });

  if (!question) {
    throw new Error('Question not found');
  }

  // Find all variants of this question
  const variants = await Variants.findAll({
    where: { questionMetadataId: questionId }
  });

  if (variants.length === 0) {
    return { isInAssessments: false, assessmentIds: [] };
  }

  const variantIds = variants.map((v) => v.id);

  // Find all section variant links for these variants
  const sectionVariantLinks = await SectionVariants.findAll({
    where: { variantId: variantIds },
    include: [
      {
        model: AssessmentSections,
        as: 'section',
        attributes: ['id', 'assessmentId'],
        include: [
          {
            model: Assessments,
            as: 'assessment',
            attributes: ['id']
          }
        ]
      }
    ]
  });

  if (sectionVariantLinks.length === 0) {
    return { isInAssessments: false, assessmentIds: [] };
  }

  // Get unique assessment IDs
  const assessmentIds = new Set();
  sectionVariantLinks.forEach((link) => {
    if (link.section?.assessment?.id) {
      assessmentIds.add(link.section.assessment.id);
    }
  });

  return {
    isInAssessments: assessmentIds.size > 0,
    assessmentIds: Array.from(assessmentIds)
  };
};

/**
 * Remove all section variant links for a question across all assessments
 * This is used when marking a question as draft to remove it from all assessments
 * @param {number} questionId - The question metadata ID
 * @param {number} userId - The user ID for authorization
 * @returns {Promise<{removedLinks: number, affectedAssessments: number[]}>} - Number of links removed and affected assessment IDs
 */
export const removeQuestionFromAllSections = async (questionId, userId) => {
  // Verify user owns the question
  const question = await Question_Metadata.findOne({
    where: { id: questionId },
    include: [
      {
        model: Course,
        as: 'course',
        where: { userId },
        attributes: ['id']
      }
    ]
  });

  if (!question) {
    throw new Error('Question not found');
  }

  // Find all variants of this question
  const variants = await Variants.findAll({
    where: { questionMetadataId: questionId }
  });

  if (variants.length === 0) {
    return { removedLinks: 0, affectedAssessments: [] };
  }

  const variantIds = variants.map((v) => v.id);

  // Find all section variant links for these variants
  const sectionVariantLinks = await SectionVariants.findAll({
    where: { variantId: variantIds },
    include: [
      {
        model: AssessmentSections,
        as: 'section',
        attributes: ['id', 'assessmentId'],
        include: [
          {
            model: Assessments,
            as: 'assessment',
            attributes: ['id']
          }
        ]
      }
    ]
  });

  if (sectionVariantLinks.length === 0) {
    return { removedLinks: 0, affectedAssessments: [] };
  }

  // Get unique assessment IDs
  const affectedAssessmentIds = new Set();
  sectionVariantLinks.forEach((link) => {
    if (link.section?.assessment?.id) {
      affectedAssessmentIds.add(link.section.assessment.id);
    }
  });

  // Delete all section variant links
  const deletedCount = await SectionVariants.destroy({
    where: { variantId: variantIds }
  });

  // Update questionOrder for each affected assessment
  const currentOrder = question.questionOrder || {};
  affectedAssessmentIds.forEach((assessmentId) => {
    delete currentOrder[assessmentId];
  });
  await question.update({ questionOrder: currentOrder });

  return {
    removedLinks: deletedCount,
    affectedAssessments: Array.from(affectedAssessmentIds)
  };
};