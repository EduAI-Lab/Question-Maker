import { TourConfig } from './tourTypes';

export const tourSteps: TourConfig = {
  main: [
    {
      id: 'course-select',
      title: 'Select a course',
      content: 'Start here: Add a course to your account and start making questions.',
      placement: 'bottom'
    },
    {
      id: 'add-question-btn',
      title: 'Create a question',
      content: 'Create questions from scratch or generate with AI.',
      placement: 'right'
    },
    {
      id: 'upload-questions-btn',
      title: 'Upload Questions',
      content: 'Upload questions from an existing assignment to have them added to the question bank.',
      placement: 'right'
    },
    {
      id: 'question-list',
      title: 'Review your questions',
      content: 'View existing question variants from your question bank.',
      placement: 'top'
    },
    {
      id: 'assessment-tab',
      title: 'Switch to assessments',
      content: 'Use this tab switcher to switch between Questions and Assessments.',
      placement: 'bottom'
    },
    {
      id: 'add-assessment-btn',
      title: 'Create assessment',
      content: 'Create an assessment in this course.',
      placement: 'bottom'
    },
    {
      id: 'assessment-view-btn',
      title: 'Edit assessment',
      content: 'Edit assessments and export.',
      placement: 'bottom'
    }
  ]
};
