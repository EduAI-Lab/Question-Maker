import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import assessmentService from '../services/assessmentService';
import { courseService } from '../services/courseService';
import { questionService } from '../services/questionService';
import { Assessment, Question, QuestionVariantEntry } from '../types/question';
import { Topic } from '../types/topic';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { AssessmentBuilder } from '../components/assessments/AssessmentBuilder';
import { AddQuestionDialog } from '../components/questions/AddQuestionDialog';
import { useToast } from '../components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';

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
        setPresetVariant(entry);
        setIsAddQuestionOpen(true);
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
            <div className="p-6">
                <p className="text-sm text-muted-foreground">Loading assessment builder…</p>
            </div>
        );
    }

    if (!assessment || error) {
        return (
            <div className="p-6 space-y-3">
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
        );
    }

    return (
        <>
            <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
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
                    <h1 className="text-lg font-semibold text-foreground">Assessment builder</h1>
                </div>

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
            </div>

            <Dialog open={!!viewEntry} onOpenChange={(open) => !open && setViewEntry(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Question preview</DialogTitle>
                    </DialogHeader>
                    {viewEntry && (
                        <div className="space-y-3 text-sm">
                            <div className="space-y-1">
                                <p className="font-semibold">Question text</p>
                                <p className="whitespace-pre-line text-foreground">
                                    {viewEntry.variant.questionText}
                                </p>
                            </div>
                            {viewEntry.variant.choices && viewEntry.variant.choices.length > 0 && (
                                <div className="space-y-1">
                                    <p className="font-semibold">Choices</p>
                                    <ul className="list-disc list-inside space-y-0.5">
                                        {viewEntry.variant.choices.map((choice) => (
                                            <li key={choice.letter}>
                                                <span className="font-mono mr-1">{choice.letter}.</span>
                                                {choice.text}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {viewEntry.variant.answer && (
                                <div className="space-y-1">
                                    <p className="font-semibold">Answer</p>
                                    <p className="whitespace-pre-line text-foreground">
                                        {viewEntry.variant.answer}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {assessment.course?.id && (
                <AddQuestionDialog
                    open={isAddQuestionOpen}
                    onClose={() => setIsAddQuestionOpen(false)}
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

