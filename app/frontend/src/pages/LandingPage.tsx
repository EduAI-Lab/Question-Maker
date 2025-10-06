import { useEffect, useState } from 'react';
import { TopNavigation } from '../components/navigation/TopNavigation';
import { QuestionBank } from '../components/question-bank/QuestionBank';
import { AssessmentSection } from '../components/assessments/AssessmentSection';
import { QuestionDetailView } from '../components/question-detail/QuestionDetailView';
import { mockAssessments } from '../data/mockData';
import { Course } from '../types/class';
import { Question, Assessment } from '../types/question';
import { useCourses } from '../hooks/useCourses';
import { questionService } from '../services/questionService';

export const LandingPage = () => {
  const { courses, isLoading: isCoursesLoading } = useCourses();
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [activeTab, setActiveTab] = useState<'questions' | 'assessments'>('questions');
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isQuestionsLoading, setIsQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>(mockAssessments);

  useEffect(() => {
    if (courses.length === 0) {
      setSelectedCourse(null);
      setQuestions([]);
      return;
    }

    if (!selectedCourse || !courses.some(course => course.id === selectedCourse.id)) {
      setSelectedCourse(courses[0]);
    }
  }, [courses, selectedCourse]);

  // Filter questions by selected course
  const filteredQuestions = selectedCourse
    ? questions.filter(q => q.courseId === selectedCourse.id)
    : questions;

  const emptyStateMessage = selectedCourse
    ? questionsError || 'No questions found for this course yet. Try adding or uploading questions.'
    : courses.length === 0
      ? 'No courses available yet. Create a course to get started.'
      : 'Select a course to view its questions.';

  // Filter assessments by selected course
  const filteredAssessments = selectedCourse
    ? assessments.filter(a => a.courseId === selectedCourse.id)
    : assessments;

  const handleViewQuestion = (question: Question) => {
    setSelectedQuestion(question);
  };

  const handleCloseQuestionDetail = () => {
    setSelectedQuestion(null);
  };

  const handleEditQuestion = (question: Question) => {
    console.log('Edit question:', question);
    // TODO: Implement edit functionality
    setSelectedQuestion(null);
  };

  const handleCreateVariant = (question: Question) => {
    console.log('Create variant for question:', question);
    // TODO: Implement variant creation
    setSelectedQuestion(null);
  };

  const handleDeleteQuestion = async (question: Question) => {
    try {
      await questionService.deleteQuestion(question.id);
      setQuestions(prev => prev.filter(q => q.id !== question.id));
    } catch (error) {
      console.error('Failed to delete question', error);
    } finally {
      setSelectedQuestion(null);
    }
  };

  const handleAddQuestion = () => {
    console.log('Add new question');
    // TODO: Implement add question functionality
  };

  const handleUploadQuestions = () => {
    console.log('Upload questions');
    // TODO: Implement upload questions functionality
  };

  const handleEditAssessment = (assessment: Assessment) => {
    console.log('Edit assessment:', assessment);
    // TODO: Implement edit assessment functionality
  };

  const handleExportAssessment = (assessment: Assessment) => {
    console.log('Export assessment:', assessment);
    // TODO: Implement export functionality
  };

  const handleAddAssessment = () => {
    console.log('Add new assessment');
    // TODO: Implement add assessment functionality
  };

  const handleReorderQuestions = (assessmentId: number, questionIds: number[]) => {
    setAssessments(prev => 
      prev.map(assessment => 
        assessment.id === assessmentId 
          ? { ...assessment, questions: questionIds }
          : assessment
      )
    );
  };

  useEffect(() => {
    const fetchQuestions = async () => {
      if (!selectedCourse) {
        setQuestions([]);
        setSelectedQuestion(null);
        return;
      }

      setIsQuestionsLoading(true);
      setQuestionsError(null);

      try {
        const data = await questionService.getQuestions({ courseId: selectedCourse.id });
        setQuestions(data);
      } catch (error: any) {
        setQuestions([]);
        setQuestionsError(error?.response?.data?.error || 'Failed to load questions');
      } finally {
        setIsQuestionsLoading(false);
      }
    };

    fetchQuestions();
  }, [selectedCourse]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <TopNavigation
        selectedCourse={selectedCourse}
        onCourseChange={setSelectedCourse}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        courses={courses}
        isLoadingCourses={isCoursesLoading}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'questions' ? (
          <QuestionBank
            questions={filteredQuestions}
            onViewQuestion={handleViewQuestion}
            onCreateVariant={handleCreateVariant}
            onAddQuestion={handleAddQuestion}
            onUploadQuestions={handleUploadQuestions}
            isLoading={isQuestionsLoading}
            courseName={selectedCourse?.name}
            emptyMessage={emptyStateMessage}
          />
        ) : (
          <AssessmentSection
            assessments={filteredAssessments}
            questions={questions}
            onEditAssessment={handleEditAssessment}
            onExportAssessment={handleExportAssessment}
            onAddAssessment={handleAddAssessment}
            onReorderQuestions={handleReorderQuestions}
          />
        )}
      </div>

      {/* Question Detail Modal */}
      {selectedQuestion && (
        <QuestionDetailView
          question={selectedQuestion}
          onClose={handleCloseQuestionDetail}
          onEdit={handleEditQuestion}
          onCreateVariant={handleCreateVariant}
          onDelete={handleDeleteQuestion}
        />
      )}
    </div>
  );
};
