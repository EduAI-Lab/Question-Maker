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
                attributes: ['id', 'description', 'type', 'questionOrder'],
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
