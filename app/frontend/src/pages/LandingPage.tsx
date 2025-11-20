import { useCallback, useEffect, useMemo, useState } from 'react';
import { TopNavigation } from '../components/navigation/TopNavigation';
import { QuestionBank } from '../components/question-bank/QuestionBank';
import { AssessmentSection } from '../components/assessments/AssessmentSection';
import { QuestionDetailView } from '../components/question-detail/QuestionDetailView';
import { Course, Question, Assessment, QuestionVariantEntry, AssessmentGenerationParams } from '../types/question';
import { Topic } from '../types/topic';
import { useCourses } from '../hooks/useCourses';
import { questionService } from '../services/questionService';
import { courseService } from '../services/courseService';
import assessmentService from '../services/assessmentService';
import { AddQuestionDialog } from '../components/questions/AddQuestionDialog';
import { QuestionUploadDialog } from '../components/question-bank/QuestionUploadDialog';
import { ProfileCoursesDialog } from '../components/profile/ProfileCoursesDialog';
import { CanvasExportDialog } from '../components/canvas/CanvasExportDialog';
import { useToast } from '../components/ui/use-toast';
import { DeleteConfirmationModal } from '../components/ui/DeleteConfirmationModal';

export const LandingPage = () => {
  const { courses, isLoading: isCoursesLoading, fetchCourses } = useCourses();
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [activeTab, setActiveTab] = useState<'questions' | 'assessments'>('questions');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<QuestionVariantEntry | null>(null);
  const [isQuestionsLoading, setIsQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isAssessmentsLoading, setIsAssessmentsLoading] = useState(false);
  const [assessmentsError, setAssessmentsError] = useState<string | null>(null);
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [presetVariant, setPresetVariant] = useState<QuestionVariantEntry | null>(null);
  const [topicsByCourse, setTopicsByCourse] = useState<Record<number, Topic[]>>({});
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isCanvasExportOpen, setIsCanvasExportOpen] = useState(false);
  const [selectedAssessmentForExport, setSelectedAssessmentForExport] = useState<{ id: number; name: string } | null>(null);
  const [deleteAssessmentModalOpen, setDeleteAssessmentModalOpen] = useState(false);
  const [assessmentToDelete, setAssessmentToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeletingAssessment, setIsDeletingAssessment] = useState(false);
  const [deleteVariantModalOpen, setDeleteVariantModalOpen] = useState(false);
  const [variantToDelete, setVariantToDelete] = useState<QuestionVariantEntry | null>(null);
  const [isDeletingVariant, setIsDeletingVariant] = useState(false);
  const { toast } = useToast();

  const loadTopicsForCourse = useCallback(async (courseId: number, options: { force?: boolean } = {}) => {
    if (!courseId) {
      return [] as Topic[];
    }

    if (!options.force && topicsByCourse[courseId]) {
      return topicsByCourse[courseId];
    }

    try {
      const topics = await courseService.getCourseTopics(courseId);
      setTopicsByCourse((prev) => ({
        ...prev,
        [courseId]: topics
      }));
      return topics;
    } catch (error) {
      console.error('Failed to load topics for course', courseId, error);
      return [];
    }
  }, [topicsByCourse]);

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

  useEffect(() => {
    if (selectedCourse) {
      void loadTopicsForCourse(selectedCourse.id);
    }
  }, [selectedCourse, loadTopicsForCourse]);

  const fetchAssessments = useCallback(async () => {
    try {
      setIsAssessmentsLoading(true);
      setAssessmentsError(null);
      const data = await assessmentService.getAssessments();
      setAssessments(data);
    } catch (error: any) {
      setAssessments([]);
      setAssessmentsError(error?.response?.data?.error || 'Failed to load assessments');
    } finally {
      setIsAssessmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAssessments();
  }, [fetchAssessments]);

  const filteredQuestions = useMemo(() => {
    if (!selectedCourse) return questions;
    return questions.filter((question) => question.courseId === selectedCourse.id);
  }, [questions, selectedCourse]);

  const variantEntries: QuestionVariantEntry[] = useMemo(() => {
    return filteredQuestions.flatMap((question) => {
      const topics = topicsByCourse[question.courseId] ?? [];
      const topicNameMap = new Map(topics.map((topic) => [topic.id, topic.name]));
      const resolveTopicName = (topicId: number) => topicNameMap.get(topicId) ?? `Topic ${topicId}`;

      return (question.variants || []).map((variant) => {
        const secondaryTopicNames = Array.isArray(variant.secondaryTopicsId)
          ? variant.secondaryTopicsId.map((topicId) => resolveTopicName(topicId))
          : [];

        return {
          questionId: question.id,
          questionDescription: question.description,
          questionType: question.type,
          primaryTopicId: question.primaryTopicId,
          primaryTopicName: topicNameMap.get(question.primaryTopicId),
          courseId: question.courseId,
          courseName: question.course?.name,
          courseCode: question.course?.code,
          secondaryTopicNames: secondaryTopicNames.length > 0 ? secondaryTopicNames : undefined,
          variant
        };
      });
    });
  }, [filteredQuestions, topicsByCourse]);

  const emptyStateMessage = selectedCourse
    ? questionsError || 'No questions found for this course yet. Try adding or uploading questions.'
    : courses.length === 0
      ? 'No courses available yet. Create a course to get started.'
      : 'Select a course to view its questions.';

  const filteredAssessments = useMemo(() => {
    if (!selectedCourse) return assessments;
    return assessments.filter((assessment) => assessment.courseId === selectedCourse.id);
  }, [assessments, selectedCourse]);

  const handleViewVariant = (entry: QuestionVariantEntry) => {
    setSelectedVariant(entry);
  };

  const handleQuestionsUploaded = async (createdQuestions: Question[]) => {
    if (createdQuestions.length === 0) {
      setIsUploadOpen(false);
      return;
    }

    const uniqueCourseIds = Array.from(new Set(createdQuestions.map((question) => question.courseId)));
    const topicsMap = new Map<number, Topic[]>();

    await Promise.all(
      uniqueCourseIds.map(async (courseId) => {
        const topics = await loadTopicsForCourse(courseId, { force: true });
        topicsMap.set(courseId, topics);
      })
    );

    setQuestions((prev) => {
      const merged = new Map<number, Question>();
      createdQuestions.forEach((question) => {
        merged.set(question.id, question);
      });
      prev.forEach((question) => {
        if (!merged.has(question.id)) {
          merged.set(question.id, question);
        }
      });
      return Array.from(merged.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    setSelectedVariant(null);
    setPresetVariant(null);
    setIsUploadOpen(false);
  };

  const handleCloseDetail = () => {
    setSelectedVariant(null);
  };

  const handleCreateVariant = (entry: QuestionVariantEntry) => {
    setPresetVariant(entry);
    setIsAddQuestionOpen(true);
    setSelectedVariant(null);
  };

  const handleDeleteVariant = (entry: QuestionVariantEntry) => {
    setVariantToDelete(entry);
    setDeleteVariantModalOpen(true);
  };

  const confirmDeleteVariant = async () => {
    if (!variantToDelete) return;
    const entry = variantToDelete;
    try {
      setIsDeletingVariant(true);
      const question = questions.find((item) => item.id === entry.questionId);
      if (!question) {
        return;
      }

      const isLastVariant = (question.variants?.length ?? 0) <= 1;

      if (isLastVariant) {
        await questionService.deleteQuestion(question.id);
        setQuestions((prev) => prev.filter((item) => item.id !== question.id));
      } else {
        await questionService.deleteVariant(entry.variant.id);
        setQuestions((prev) =>
          prev.map((item) =>
            item.id === question.id
              ? { ...item, variants: item.variants?.filter((variant) => variant.id !== entry.variant.id) ?? [] }
              : item
          )
        );
      }
      setSelectedVariant(null);
    } catch (error) {
      console.error('Failed to delete variant', error);
      toast({
        title: 'Failed to delete question',
        description: 'Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsDeletingVariant(false);
      setVariantToDelete(null);
    }
  };

  const handleAddQuestion = () => {
    setPresetVariant(null);
    setIsAddQuestionOpen(true);
  };

  const handleQuestionCreated = (question: Question) => {
    void loadTopicsForCourse(question.courseId);
    const topicsForCourse = topicsByCourse[question.courseId] ?? [];
    const topicNameMap = new Map(topicsForCourse.map((topic) => [topic.id, topic.name]));

    setQuestions((prev) => {
      const index = prev.findIndex((item) => item.id === question.id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = question;
        return next;
      }
      return [question, ...prev];
    });

    setPresetVariant(null);
    setIsAddQuestionOpen(false);
  };

  const handleUploadQuestions = () => {
    if (selectedCourse) {
      void loadTopicsForCourse(selectedCourse.id);
    }
    setIsUploadOpen(true);
  };

  const handleDeleteAssessment = (assessmentId: number, assessmentName: string) => {
    setAssessmentToDelete({ id: assessmentId, name: assessmentName });
    setDeleteAssessmentModalOpen(true);
  };

  const confirmDeleteAssessment = async () => {
    if (!assessmentToDelete) return;
    try {
      setIsDeletingAssessment(true);
      await assessmentService.deleteAssessment(assessmentToDelete.id);
      setAssessments((prev) => prev.filter((item) => item.id !== assessmentToDelete.id));
      toast({
        title: 'Assessment deleted',
        description: `"${assessmentToDelete.name}" has been removed.`
      });
      setAssessmentToDelete(null);
    } catch (_error) {
      toast({
        title: 'Failed to delete assessment',
        description: 'Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsDeletingAssessment(false);
    }
  };

  const handleCreateAssessment = async (params: AssessmentGenerationParams) => {
    try {
      const created = await assessmentService.createAssessment(params);
      setAssessments((prev) => [created, ...prev]);
    } catch (error) {
      console.error('Failed to create assessment', error);
    }
  };

  useEffect(() => {
    const fetchQuestions = async () => {
      if (!selectedCourse) {
        setQuestions([]);
        setSelectedVariant(null);
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

  useEffect(() => {
    if (!selectedVariant) {
      return;
    }

    const updated = variantEntries.find(
      (entry) =>
        entry.questionId === selectedVariant.questionId &&
        entry.variant.id === selectedVariant.variant.id
    );

    if (!updated) {
      return;
    }

    const prevSecondary = selectedVariant.secondaryTopicNames?.join('|') ?? '';
    const nextSecondary = updated.secondaryTopicNames?.join('|') ?? '';

    if (
      updated.primaryTopicName !== selectedVariant.primaryTopicName ||
      nextSecondary !== prevSecondary
    ) {
      setSelectedVariant(updated);
    }
  }, [variantEntries, selectedVariant]);

  useEffect(() => {
    if (!presetVariant) {
      return;
    }

    const updated = variantEntries.find(
      (entry) =>
        entry.questionId === presetVariant.questionId &&
        entry.variant.id === presetVariant.variant.id
    );

    if (!updated) {
      return;
    }

    const prevSecondary = presetVariant.secondaryTopicNames?.join('|') ?? '';
    const nextSecondary = updated.secondaryTopicNames?.join('|') ?? '';

    if (
      updated.primaryTopicName !== presetVariant.primaryTopicName ||
      nextSecondary !== prevSecondary
    ) {
      setPresetVariant(updated);
    }
  }, [variantEntries, presetVariant]);

  const relatedVariantsForSelected = useMemo(() => {
    if (!selectedVariant) {
      return [];
    }
    return variantEntries.filter((entry) => entry.questionId === selectedVariant.questionId);
  }, [variantEntries, selectedVariant?.questionId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation
        selectedCourse={selectedCourse}
        onCourseChange={setSelectedCourse}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        courses={courses}
        isLoadingCourses={isCoursesLoading}
        onProfileClick={() => setIsProfileDialogOpen(true)}
      />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'questions' ? (
          <QuestionBank
            variants={variantEntries}
            onViewVariant={handleViewVariant}
            onCreateVariant={handleCreateVariant}
            onAddQuestion={handleAddQuestion}
            onUploadQuestions={handleUploadQuestions}
            isLoading={isQuestionsLoading}
            courseName={selectedCourse?.name}
            emptyMessage={emptyStateMessage}
            disableAdd={!selectedCourse}
            disableUpload={!selectedCourse}
          />
        ) : (
        <AssessmentSection
          assessments={filteredAssessments}
          onAddAssessment={handleCreateAssessment}
          isLoading={isAssessmentsLoading}
          loadError={assessmentsError}
          selectedCourseId={selectedCourse?.id ?? null}
          onExportToCanvas={(assessmentId, assessmentName) => {
            setSelectedAssessmentForExport({ id: assessmentId, name: assessmentName });
            setIsCanvasExportOpen(true);
          }}
          onDeleteAssessment={handleDeleteAssessment}
        />
        )}
      </div>

      {selectedVariant && (
        <QuestionDetailView
          entry={selectedVariant}
          relatedVariants={relatedVariantsForSelected}
          onClose={handleCloseDetail}
          onCreateVariant={handleCreateVariant}
          onDeleteVariant={handleDeleteVariant}
          onSelectVariant={handleViewVariant}
        />
      )}

      <QuestionUploadDialog
        open={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        courseId={selectedCourse?.id ?? null}
        courseName={selectedCourse?.name}
        topics={selectedCourse ? (topicsByCourse[selectedCourse.id] ?? []) : []}
        onEnsureTopics={loadTopicsForCourse}
        onQuestionsSaved={handleQuestionsUploaded}
      />

      <AddQuestionDialog
        open={isAddQuestionOpen}
        onClose={() => {
          setIsAddQuestionOpen(false);
          setPresetVariant(null);
        }}
        courseId={selectedCourse?.id ?? null}
        variants={variantEntries}
        onQuestionCreated={handleQuestionCreated}
        presetVariant={presetVariant}
      />

      <ProfileCoursesDialog
        open={isProfileDialogOpen}
        onClose={() => setIsProfileDialogOpen(false)}
        existingCourses={courses}
        onCoursesAdded={fetchCourses}
      />

      {selectedAssessmentForExport && (
        <CanvasExportDialog
          open={isCanvasExportOpen}
          onClose={() => {
            setIsCanvasExportOpen(false);
            setSelectedAssessmentForExport(null);
          }}
          assessmentId={selectedAssessmentForExport.id}
          assessmentName={selectedAssessmentForExport.name}
          onExportSuccess={(result) => {
            toast({
              title: 'Export successful!',
              description: `Assessment exported to Canvas. Quiz ID: ${result.quizId}`,
            });
          }}
        />
      )}
      <DeleteConfirmationModal
        open={deleteVariantModalOpen}
        onOpenChange={setDeleteVariantModalOpen}
        onConfirm={confirmDeleteVariant}
        title={
          variantToDelete
            ? (() => {
                const question = questions.find((item) => item.id === variantToDelete.questionId);
                const isLastVariant = question && (question.variants?.length ?? 0) <= 1;
                return isLastVariant
                  ? 'Delete question?'
                  : 'Delete question variant?';
              })()
            : 'Delete question?'
        }
        message={
          variantToDelete
            ? (() => {
                const question = questions.find((item) => item.id === variantToDelete.questionId);
                const isLastVariant = question && (question.variants?.length ?? 0) <= 1;
                return isLastVariant
                  ? 'This will permanently delete the entire question and all its variants. This action cannot be undone.'
                  : 'This will permanently delete this question variant. This action cannot be undone.';
              })()
            : 'This action cannot be undone.'
        }
        confirmLabel="Delete"
        isLoading={isDeletingVariant}
      />
      <DeleteConfirmationModal
        open={deleteAssessmentModalOpen}
        onOpenChange={setDeleteAssessmentModalOpen}
        onConfirm={confirmDeleteAssessment}
        title={assessmentToDelete ? `Delete assessment "${assessmentToDelete.name}"?` : 'Delete assessment?'}
        message="This action cannot be undone. All sections and questions in this assessment will be removed."
        confirmLabel="Delete"
        isLoading={isDeletingAssessment}
      />
    </div>
  );
};
