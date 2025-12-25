import { TourConfig } from './tourTypes';

export const tourSteps: TourConfig = {
  main: [
    {
      id: 'profile-courses-button',
      title: 'Link your courses',
      content: 'Start here: open your profile to link courses from EduAI and import topics.',
      placement: 'bottom'
    },
    {
      id: 'course-select',
      title: 'Pick your course',
      content: 'Everything is scoped to a course. Choose one first so questions and topics stay organized.',
      placement: 'bottom'
    },
    {
      id: 'top-nav-tabs',
      title: 'Questions vs Assessments',
      content: 'Switch between managing the question bank and building assessments.',
      placement: 'bottom'
    },
    {
      id: 'help-button',
      title: 'Help and guides',
      content: 'Open the Help page for FAQs and docs. You can restart this tour from there.',
      placement: 'bottom'
    },
    {
      id: 'eduai-status',
      title: 'EduAI availability',
      content: 'Quickly see if EduAI is online before generating questions or variants.',
      placement: 'bottom'
    },
    {
      id: 'add-question-btn',
      title: 'Create a question',
      content: 'Open Add Question to create manually or with EduAI; save as draft or reviewed.',
      placement: 'right'
    },
    {
      id: 'upload-questions-btn',
      title: 'Upload assessments',
      content: 'Upload a PDF/image to OCR and extract questions; review and create them in one flow.',
      placement: 'right'
    },
    {
      id: 'question-list',
      title: 'Review your questions',
      content: 'Search, filter, and view variants. Draft questions block exports until reviewed.',
      placement: 'top'
    },
    {
      id: 'assessment-tab',
      title: 'Open assessments',
      content: 'Switch to the Assessments tab to build blueprints and exports.',
      placement: 'bottom'
    },
    {
      id: 'add-assessment-btn',
      title: 'Create blueprint',
      content: 'Start a new assessment and seed it with topics and defaults.',
      placement: 'bottom'
    },
    {
      id: 'assessment-list',
      title: 'Assessments',
      content: 'Open assessments to add sections and attach question variants.',
      placement: 'top'
    },
    {
      id: 'export-canvas-btn',
      title: 'Canvas export',
      content: 'Exports require reviewed (non-draft) questions. Connect with Canvas API key first.',
      placement: 'bottom'
    },
    {
      id: 'export-txt-btn',
      title: 'TXT export',
      content: 'Download a TXT snapshot for offline review or sharing.',
      placement: 'bottom'
    }
  ]
};
