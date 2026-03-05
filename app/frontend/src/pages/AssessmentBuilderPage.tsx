import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import assessmentService from '../services/assessmentService';
import { courseService } from '../services/courseService';
import { questionService } from '../services/questionService';
import { Assessment, Question, QuestionVariantEntry } from '../types/question';
import { Topic } from '../types/topic';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { AssessmentBuilder } from '../components/assessments/AssessmentBuilder';
import { AddQuestionDialog } from '../components/questions/AddQuestionDialog';
import { useToast } from '../components/ui/use-toast';
import { QuestionDetailView } from '../components/question-detail/QuestionDetailView';

const AssessmentBuilderPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const assessmentId = Number(id);
    const { toast } = useToast();

    const [assessment, setAssessment] = useState<Assessment | null>(null);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewEntry, setViewEntry] = useState<QuestionVariantEntry | null>(null);
    const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
    const [presetVariant, setPresetVariant] = useState<QuestionVariantEntry | null>(null);

    useEffect(() => {
        const load = async () => {
            if (Number.isNaN(assessmentId)) return;
            try {
                setIsLoading(true);
                setError(null);
                const loadedAssessment = await assessmentService.getAssessment(assessmentId);
                setAssessment(loadedAssessment);

                if (loadedAssessment.course?.id) {
                    const [courseTopics, courseQuestions] = await Promise.all([
                        courseService.getCourseTopics(loadedAssessment.course.id),
                        questionService.getQuestions({ courseId: loadedAssessment.course.id, limit: 500 })
                    ]);
                    setTopics(courseTopics);
                    setQuestions(courseQuestions);
                } else {
                    setTopics([]);
                    setQuestions([]);
                }
            } catch (loadError: any) {
                setError(loadError?.response?.data?.error || 'Failed to load assessment builder');
            } finally {
                setIsLoading(false);
            }
        };

        load();
    }, [assessmentId]);

    const topicById = useMemo(() => {
        const map: Record<number, Topic> = {};
        topics.forEach((topic) => {
            map[topic.id] = topic;
        });
        return map;
    }, [topics]);

    const questionVariantEntries = useMemo<QuestionVariantEntry[]>(() => {
        const resolveTopicName = (topicId: number) => topicById[topicId]?.name ?? `Topic ${topicId}`;
        return questions.flatMap((question) =>
            (question.variants ?? []).map((variant) => {
                const secondaryTopicNames = Array.isArray(variant.secondaryTopicsId)
                    ? (variant.secondaryTopicsId
                          .map((topicId) => resolveTopicName(topicId))
                          .filter(Boolean) as string[])
                    : undefined;

                return {
                    questionId: question.id,
                    questionDescription: question.description,
                    questionType: question.type,
                    primaryTopicId: question.primaryTopicId,
                    primaryTopicName: resolveTopicName(question.primaryTopicId),
                    courseId: question.courseId,
                    courseName: question.course?.name,
                    courseCode: question.course?.code,
                    secondaryTopicNames:
                        secondaryTopicNames && secondaryTopicNames.length > 0 ? secondaryTopicNames : undefined,
                    isAiGenerated: variant.isAiGenerated,
                    isDraft: variant.isDraft,
                    variant
                };
            })
        );
    }, [questions, topicById]);

    const hasDraftQuestions = useMemo(() => {
        if (!assessment?.sections) return false;
        const variantIdsInSections = new Set(
            assessment.sections.flatMap((s) => (s.sectionVariants ?? []).map((l) => l.variantId))
        );
        return questionVariantEntries.some(
            (e) => variantIdsInSections.has(e.variant.id) && (e.isDraft ?? e.variant.isDraft === true)
        );
    }, [assessment?.sections, questionVariantEntries]);

    const refreshQuestionsAndAssessment = async () => {
        if (!assessment?.course?.id) return;
        try {
            const [courseQuestions, updatedAssessment] = await Promise.all([
                questionService.getQuestions({ courseId: assessment.course.id, limit: 500 }),
                assessmentService.getAssessment(assessment.id)
            ]);
            setQuestions(courseQuestions);
            setAssessment(updatedAssessment);
        } catch (refreshError: any) {
            toast({
                title: 'Failed to refresh assessment data',
                description: refreshError?.response?.data?.error || 'Please try again.',
                variant: 'destructive'
            });
        }
    };

    const handleViewQuestion = (entry: QuestionVariantEntry) => {
        setViewEntry(entry);
    };

    const handleToggleDraft = async (entry: QuestionVariantEntry, nextDraft: boolean) => {
        try {
            await questionService.updateVariant(entry.variant.id, { isDraft: nextDraft });
            await refreshQuestionsAndAssessment();
            toast({
                title: 'Review status updated',
                description: `Variant is now ${nextDraft ? 'marked as draft' : 'marked as reviewed'}.`
            });
        } catch (toggleError: any) {
            toast({
                title: 'Failed to update review status',
                description: toggleError?.response?.data?.error || 'Please try again.',
                variant: 'destructive'
            });
        }
    };

    const handleCreateVariant = (entry: QuestionVariantEntry) => {
        if (!assessment?.course?.id) {
            toast({
                title: 'Select a course first',
                description: 'Unable to create a variant without course context.',
                variant: 'destructive'
            });
            return;
        }
        setViewEntry(null);
        setPresetVariant(entry);
        setIsAddQuestionOpen(true);
    };

    const handleUpdateVariant = async (
        variantId: number,
        _updates: { isDraft?: boolean; isAiGenerated?: boolean; difficulty?: string; choices?: unknown; answer?: string | null }
    ) => {
        await refreshQuestionsAndAssessment();
        if (viewEntry?.variant.id === variantId) {
            const next = questionVariantEntries.find((e) => e.variant.id === variantId);
            if (next) setViewEntry(next);
        }
    };

    const handleUpdateQuestionMetadata = async (
        questionId: number,
        _updates: { description?: string | null; primaryTopicId?: number; type?: string; primaryTopicName?: string }
    ) => {
        try {
            const fetched = await questionService.getQuestion(questionId);
            await refreshQuestionsAndAssessment();
            if (viewEntry?.questionId === questionId) {
                const resolveTopicName = (topicId: number) => topicById[topicId]?.name ?? `Topic ${topicId}`;
                const variant = fetched.variants?.find((v) => v.id === viewEntry.variant.id) ?? viewEntry.variant;
                const secondaryTopicNames = Array.isArray(variant.secondaryTopicsId)
                    ? (variant.secondaryTopicsId
                          .map((tid) => resolveTopicName(tid))
                          .filter(Boolean) as string[])
                    : undefined;
                setViewEntry({
                    questionId: fetched.id,
                    questionDescription: fetched.description ?? null,
                    questionType: fetched.type,
                    primaryTopicId: fetched.primaryTopicId,
                    primaryTopicName: resolveTopicName(fetched.primaryTopicId),
                    courseId: fetched.courseId,
                    courseName: fetched.course?.name,
                    courseCode: fetched.course?.code,
                    secondaryTopicNames:
                        secondaryTopicNames && secondaryTopicNames.length > 0 ? secondaryTopicNames : undefined,
                    isAiGenerated: variant.isAiGenerated,
                    isDraft: variant.isDraft,
                    variant
                });
            }
        } catch (err: unknown) {
            toast({
                title: 'Update failed',
                description: (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Please try again.',
                variant: 'destructive'
            });
        }
    };

    const handleDeleteVariant = async (entry: QuestionVariantEntry) => {
        const question = questions.find((q) => q.id === entry.questionId);
        if (!question) return;
        try {
            const isLastVariant = (question.variants?.length ?? 0) <= 1;
            if (isLastVariant) {
                await questionService.deleteQuestion(question.id);
            } else {
                await questionService.deleteVariant(entry.variant.id);
            }
            await refreshQuestionsAndAssessment();
            if (viewEntry?.variant.id === entry.variant.id) setViewEntry(null);
            toast({
                title: 'Question removed',
                description: isLastVariant ? 'Question deleted.' : 'Variant removed.'
            });
        } catch (err: unknown) {
            toast({
                title: 'Delete failed',
                description: (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Please try again.',
                variant: 'destructive'
            });
        }
    };

    const handleQuestionCreated = (newQuestion: Question) => {
        setIsAddQuestionOpen(false);
        void (async () => {
            await refreshQuestionsAndAssessment();
            toast({
                title: 'Question saved',
                description: 'The question and its variants have been updated. You can now add it to sections.'
            });
        })();
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="mx-auto max-w-6xl px-6 py-8">
                    <p className="text-sm text-muted-foreground">Loading assessment builder…</p>
                </div>
            </div>
        );
    }

    if (!assessment || error) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="mx-auto max-w-6xl space-y-4 px-6 py-8">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(-1)}
                        className="gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Assessment builder</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-destructive">
                                {error ?? 'Assessment not found or failed to load.'}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="min-h-screen bg-gray-50">
                <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(-1)}
                            className="gap-1.5 text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>
                        <div className="text-sm text-muted-foreground">Assessment Builder</div>
                    </div>

                    <Card className="border border-gray-200">
                        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <CardTitle className="text-2xl font-semibold text-gray-900">
                                        {assessment.name}
                                    </CardTitle>
                                    {hasDraftQuestions && (
                                        <Badge
                                            variant="secondary"
                                            className="flex items-center gap-1 border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200"
                                        >
                                            <AlertTriangle className="h-3 w-3" />
                                            Contains Draft questions
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {assessment.type && (
                                        <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">
                                            {assessment.type}
                                        </Badge>
                                    )}
                                    {assessment.semester && (
                                        <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">
                                            {assessment.semester}
                                        </Badge>
                                    )}
                                    {assessment.course?.name && (
                                        <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">
                                            {assessment.course.name}
                                        </Badge>
                                    )}
                                </div>
                                {assessment.description && (
                                    <p className="text-sm text-gray-500">{assessment.description}</p>
                                )}
                            </div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                Builder view
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <AssessmentBuilder
                    assessment={assessment}
                    questionBank={questionVariantEntries}
                    topics={topics}
                    onAddSection={async () => {
                        if (!assessment) return;
                        const existing = assessment.sections ?? [];
                        const nextPosition =
                            existing.length > 0 ? Math.max(...existing.map((s) => s.position)) + 1 : 1;
                        try {
                            const created = await assessmentService.createSection(assessment.id, {
                                name: `Section ${existing.length + 1}`,
                                position: nextPosition
                            });
                            setAssessment((prev) =>
                                prev
                                    ? {
                                          ...prev,
                                          sections: [...(prev.sections ?? []), created].sort(
                                              (a, b) => a.position - b.position
                                          )
                                      }
                                    : prev
                            );
                        } catch (createError: any) {
                            toast({
                                title: 'Failed to create section',
                                description: createError?.response?.data?.error || 'Please try again.',
                                variant: 'destructive'
                            });
                        }
                    }}
                    onUpdateSectionName={async (sectionId, name) => {
                        if (!assessment) return;
                        try {
                            const updated = await assessmentService.updateSection(assessment.id, sectionId, { name });
                            setAssessment((prev) =>
                                prev
                                    ? {
                                          ...prev,
                                          sections: (prev.sections ?? []).map((section) =>
                                              section.id === sectionId ? updated : section
                                          )
                                      }
                                    : prev
                            );
                        } catch (updateError: any) {
                            toast({
                                title: 'Failed to rename section',
                                description: updateError?.response?.data?.error || 'Please try again.',
                                variant: 'destructive'
                            });
                        }
                    }}
                    onDeleteSection={async (sectionId) => {
                        if (!assessment) return;
                        try {
                            await assessmentService.deleteSection(assessment.id, sectionId);
                            setAssessment((prev) =>
                                prev
                                    ? {
                                          ...prev,
                                          sections: (prev.sections ?? []).filter(
                                              (section) => section.id !== sectionId
                                          )
                                      }
                                    : prev
                            );
                        } catch (deleteError: any) {
                            toast({
                                title: 'Failed to delete section',
                                description: deleteError?.response?.data?.error || 'Please try again.',
                                variant: 'destructive'
                            });
                        }
                    }}
                                onAddQuestionsToSection={async (sectionId, variantIds) => {
                        if (!assessment) return;
                        try {
                            await Promise.all(
                                variantIds.map((variantId) =>
                                    assessmentService.addVariantToSection(assessment.id, sectionId, { variantId })
                                )
                            );
                            await refreshQuestionsAndAssessment();
                        } catch (addError: any) {
                            toast({
                                title: 'Failed to add questions to section',
                                description: addError?.response?.data?.error || 'Please try again.',
                                variant: 'destructive'
                            });
                        }
                    }}
                                onRemoveQuestionFromSection={async (sectionId, variantId) => {
                        if (!assessment) return;
                        try {
                            await assessmentService.removeVariantFromSection(assessment.id, sectionId, variantId);
                            await refreshQuestionsAndAssessment();
                        } catch (removeError: any) {
                            toast({
                                title: 'Failed to remove question from section',
                                description: removeError?.response?.data?.error || 'Please try again.',
                                variant: 'destructive'
                            });
                        }
                    }}
                                onViewQuestion={handleViewQuestion}
                                onToggleDraft={handleToggleDraft}
                                onCreateVariant={handleCreateVariant}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>

            {viewEntry && (
                <QuestionDetailView
                    entry={viewEntry}
                    relatedVariants={questionVariantEntries.filter(
                        (e) => e.questionId === viewEntry.questionId
                    )}
                    onClose={() => setViewEntry(null)}
                    onCreateVariant={handleCreateVariant}
                    onUpdateVariant={handleUpdateVariant}
                    onUpdateQuestionMetadata={handleUpdateQuestionMetadata}
                    onDeleteVariant={handleDeleteVariant}
                    onSelectVariant={(entry) => setViewEntry(entry)}
                />
            )}

            {assessment.course?.id && (
                <AddQuestionDialog
                    open={isAddQuestionOpen}
                    onClose={() => {
                        setIsAddQuestionOpen(false);
                        setPresetVariant(null);
                    }}
                    courseId={assessment.course.id}
                    variants={questionVariantEntries}
                    onQuestionCreated={handleQuestionCreated}
                    presetVariant={presetVariant}
                    totalQuestionsInBank={questions.length}
                />
            )}
        </>
    );
};

export default AssessmentBuilderPage;

