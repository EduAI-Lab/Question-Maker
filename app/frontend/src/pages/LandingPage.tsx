import { useEffect, useMemo, useState } from 'react';
import { TopNavigation } from '../components/navigation/TopNavigation';
import { QuestionBank } from '../components/question-bank/QuestionBank';
import { AssessmentSection } from '../components/assessments/AssessmentSection';
import { QuestionDetailView } from '../components/question-detail/QuestionDetailView';
import { mockQuestions, mockAssessments } from '../data/mockData';
import { Course } from '../types/class';
import { Question, Assessment } from '../types/question';
import { useCourses } from '../hooks/useCourses';

export const LandingPage = () => {
  const { courses, isLoading: isCoursesLoading } = useCourses();
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'questions' | 'assessments'>('questions');
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [questions, setQuestions] = useState<Question[]>(mockQuestions);
  const [assessments, setAssessments] = useState<Assessment[]>(mockAssessments);

  const selectedCourse = useMemo(() => {
    return courses.find(course => course.id === selectedCourseId) || null;
  }, [courses, selectedCourseId]);

  useEffect(() => {
    if (courses.length > 0 && selectedCourseId === null) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  // Filter questions by selected course
  const filteredQuestions = selectedCourse 
    ? questions.filter(q => q.classId === selectedCourse.id)
    : questions;

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

  const handleDeleteQuestion = (question: Question) => {
    setQuestions(prev => prev.filter(q => q.id !== question.id));
    setSelectedQuestion(null);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <TopNavigation
        selectedCourse={selectedCourse}
        onCourseChange={(course) => setSelectedCourseId(course.id)}
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
