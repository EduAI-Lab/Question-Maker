import { useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import {
    Question,
    QuestionDifficulty,
    QuestionType,
    QuestionVariantEntry
} from '../../types/question';
import { questionService } from '../../services/questionService';
import { courseService } from '../../services/courseService';
import assessmentService from '../../services/assessmentService';
import { Assessment } from '../../types/question';
import { Topic } from '../../types/topic';
import { useToast } from '../ui/use-toast';
import eduaiService, { EduAIModelOption, EduAICourseOption } from '../../services/eduaiService';
import { Course } from '../../types/question';

interface AddQuestionDialogProps {
    open: boolean;
    onClose: () => void;
    courseId?: number | null;
    variants: QuestionVariantEntry[];
    onQuestionCreated: (question: Question) => void;
    presetVariant?: QuestionVariantEntry | null;
}

type Mode = 'new' | 'variant';

type FormState = {
    mode: Mode;
    baseSelection: string; // encoded as `${questionId}:${variantId}`
    variantText: string;
    variantDifficulty: QuestionDifficulty;
    variantAnswer: string;
    variantSecondaryTopics: number[];
    variantAssessmentId: string;
    variantReferenceId: string;
    questionType: QuestionType;
    questionDescription: string;
    primaryTopicId: string;
    questionOrder: string;
    generationPrompt: string;
    generationModel: string;
    generationDifficulty: QuestionDifficulty | 'balanced';
};

const defaultForm: FormState = {
    mode: 'new',
    baseSelection: '',
    variantText: '',
    variantDifficulty: 'medium',
    variantAnswer: '',
    variantSecondaryTopics: [],
    variantAssessmentId: 'none',
    variantReferenceId: '',
    questionType: 'MCQ',
    questionDescription: '',
    primaryTopicId: '',
    questionOrder: '',
    generationPrompt: '',
    generationModel: 'ollama:gpt-oss:120b',
    generationDifficulty: 'balanced'
};

const difficultyOptions: QuestionDifficulty[] = ['easy', 'medium', 'hard'];
const questionTypes: QuestionType[] = ['MCQ', 'SA', 'LA'];
const questionTypeLabels: Record<QuestionType, string> = {
    MCQ: 'Multiple Choice',
    SA: 'Short Answer',
    LA: 'Long Answer'
};

export const AddQuestionDialog = ({
    open,
    onClose,
    courseId,
    variants,
    onQuestionCreated,
    presetVariant
}: AddQuestionDialogProps) => {
    const [form, setForm] = useState<FormState>(defaultForm);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [assessments, setAssessments] = useState<Assessment[]>([]);
    const [isAuxLoading, setIsAuxLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [courseDetails, setCourseDetails] = useState<Course | null>(null);
    const [availableModels, setAvailableModels] = useState<EduAIModelOption[]>([]);
    const [availableEduCourses, setAvailableEduCourses] = useState<EduAICourseOption[]>([]);
    const { toast } = useToast();

    useEffect(() => {
        if (!open) {
            setForm(defaultForm);
            setError(null);
            setTopics([]);
            setAssessments([]);
            setCourseDetails(null);
            setIsGenerating(false);
            return;
        }

        if (presetVariant) {
            const referenceId = presetVariant.variant.referenceId ?? presetVariant.variant.id;
            setForm({
                ...defaultForm,
                mode: 'variant',
                baseSelection: `${presetVariant.questionId}:${presetVariant.variant.id}`,
                variantReferenceId: referenceId ? referenceId.toString() : '',
                variantDifficulty: presetVariant.variant.difficulty ?? 'medium',
                variantSecondaryTopics: presetVariant.variant.secondaryTopicsId || [],
                variantAssessmentId: presetVariant.variant.assessmentId ? presetVariant.variant.assessmentId.toString() : 'none',
                generationPrompt: 'Create a variant of this question...'
            });
        } else {
            setForm(defaultForm);
        }
        setError(null);
    }, [open, presetVariant]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const fetchSupportingData = async () => {
            if (!courseId) return;
            try {
                setIsAuxLoading(true);
                const [topicsResponse, assessmentsResponse] = await Promise.all([
                    courseService.getCourseTopics(courseId),
                    assessmentService.getAssessments({ courseId })
                ]);
                setTopics(topicsResponse);
                setAssessments(assessmentsResponse);
                setForm((prev) => ({
                    ...prev,
                    primaryTopicId: prev.primaryTopicId || (topicsResponse[0]?.id.toString() ?? '')
                }));
            } catch (loadError) {
                console.error('Failed to load topics/assessments', loadError);
                setTopics([]);
                setAssessments([]);
            } finally {
                setIsAuxLoading(false);
            }
        };

        fetchSupportingData();
    }, [open, courseId]);

    useEffect(() => {
        if (!open) {
            setAvailableModels([]);
            setAvailableEduCourses([]);
            return;
        }

        let isMounted = true;

        const loadEduAIOptions = async () => {
            try {
                const [models, eduCourses] = await Promise.all([
                    eduaiService.listModels(),
                    eduaiService.listCourses()
                ]);

                if (!isMounted) return;

                setAvailableModels(models);
                setAvailableEduCourses(eduCourses);

                if (models.length > 0) {
                    const defaultModel =
                        models.find((model) => model.isDefault) ?? models[0];
                    setForm((prev) => {
                        if (models.some((model) => model.id === prev.generationModel)) {
                            return prev;
                        }
                        return {
                            ...prev,
                            generationModel: defaultModel.id
                        };
                    });
                }
            } catch (optionsError) {
                console.error('Failed to load EduAI options', optionsError);
            }
        };

        loadEduAIOptions();

        return () => {
            isMounted = false;
        };
    }, [open]);

    useEffect(() => {
        if (!open || !courseId) {
            setCourseDetails(null);
            return;
        }

        let isMounted = true;
        const loadCourse = async () => {
            try {
                const course = await courseService.getCourse(courseId);
                if (isMounted) {
                    setCourseDetails(course);
                }
            } catch (courseError) {
                console.error('Failed to load course details', courseError);
                if (isMounted) {
                    setCourseDetails(null);
                }
            }
        };

        loadCourse();

        return () => {
            isMounted = false;
        };
    }, [open, courseId]);

    const baseVariantOptions = useMemo(
        () =>
            variants.map((entry) => ({
                value: `${entry.questionId}:${entry.variant.id}`,
                label: `Variant #${entry.variant.id} • ${entry.variant.questionText.slice(0, 60)}`,
                entry
            })),
        [variants]
    );

    const selectedBase = useMemo(() => {
        if (!form.baseSelection) return undefined;
        return baseVariantOptions.find((option) => option.value === form.baseSelection)?.entry;
    }, [form.baseSelection, baseVariantOptions]);

    const assessmentOptions = useMemo(
        () =>
            assessments.filter((assessment) =>
                courseId ? assessment.courseId === undefined || assessment.courseId === courseId : true
            ),
        [assessments, courseId]
    );

    const handleFieldChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
        if (field === 'primaryTopicId' && typeof value === 'string') {
            setForm((prev) => ({
                ...prev,
                primaryTopicId: value,
                variantSecondaryTopics: prev.variantSecondaryTopics.filter((topicId) => topicId.toString() !== value)
            }));
            return;
        }

        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const parseNumber = (value: string) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    };

    const toggleSecondaryTopic = (topicId: number, checked: boolean) => {
        setForm((prev) => {
            if (prev.primaryTopicId && Number(prev.primaryTopicId) === topicId && checked) {
                return prev;
            }

            const set = new Set(prev.variantSecondaryTopics);
            if (checked) {
                set.add(topicId);
            } else {
                set.delete(topicId);
            }
            return { ...prev, variantSecondaryTopics: Array.from(set) };
        });
    };

    const createDescriptionFromText = (text: string) => {
        const normalized = text.replace(/\s+/g, ' ').trim();
        if (!normalized) {
            return '';
        }
        const sentenceMatch = normalized.match(/[^.!?]+[.!?]?/);
        const base = (sentenceMatch ? sentenceMatch[0] : normalized).trim();
        const words = base.split(' ');
        if (words.length <= 12) {
            return base;
        }
        return `${words.slice(0, 12).join(' ')}…`;
    };

    const normalizeCourseCode = (value: string) => value.toLowerCase().replace(/\s+/g, '');

    const isCourseRecognizedByEduAI = (code: string | null | undefined) => {
        if (!code || availableEduCourses.length === 0) {
            return true;
        }

        const normalizedCode = normalizeCourseCode(code);
        const result = availableEduCourses.some((eduCourse) => {
            const candidates = [eduCourse.code, eduCourse.id, eduCourse.name];
            return candidates.some((candidate) => {
                if (!candidate) return false;
                return normalizeCourseCode(candidate) === normalizedCode;
            });
        });
        return result;
    };

    const resolveCourseCodeForEduAI = (): string | null => {
        let code = courseDetails?.code ?? null;

        if (!code) {
            const fallback = availableEduCourses.find((eduCourse) => {
                if (courseDetails?.name) {
                    const normalizedName = courseDetails.name.toLowerCase();
                    const matches =
                        eduCourse.name.toLowerCase() === normalizedName ||
                        (eduCourse.code && eduCourse.code.toLowerCase() === normalizedName) ||
                        eduCourse.id.toLowerCase() === normalizedName;
                    if (matches) {
                        console.log('[EduAI] fallback matched by name', { eduCourse, courseDetails });
                    }
                    return matches;
                }

                if (courseId) {
                    const matchesId = eduCourse.id === courseId.toString();
                    if (matchesId) {
                        console.log('[EduAI] fallback matched by id', { eduCourse, courseId });
                    }
                    return matchesId;
                }

                return false;
            });

            if (fallback) {
                console.log('[EduAI] using fallback course code', fallback);
                code = fallback.code;
            }
        }

        return code;
    };

    const resolvedCourseCodeForDisplay = resolveCourseCodeForEduAI();
    const courseWarningMessage =
        resolvedCourseCodeForDisplay && !isCourseRecognizedByEduAI(resolvedCourseCodeForDisplay)
            ? `EduAI does not recognize course code "${resolvedCourseCodeForDisplay}". Question generation will still run, but results may be less accurate.`
            : null;

    const handleGenerateWithAI = async () => {
        if (!courseId) {
            setError('Select a course before generating a question.');
            return;
        }

        const courseCode = resolveCourseCodeForEduAI();

        if (!courseCode) {
            setError(
                'EduAI requires a course code. Update the course with a code or ensure the course exists in EduAI.'
            );
            return;
        }

        if (!form.generationPrompt.trim()) {
            setError('Enter a topic or prompt before asking EduAI to generate a question.');
            return;
        }

        try {
            setIsGenerating(true);
            setError(null);

            const difficultyDistribution = (() => {
                if (form.generationDifficulty === 'balanced') {
                    return { easy: 0, medium: 1, hard: 0 };
                }
                return {
                    easy: form.generationDifficulty === 'easy' ? 1 : 0,
                    medium: form.generationDifficulty === 'medium' ? 1 : 0,
                    hard: form.generationDifficulty === 'hard' ? 1 : 0
                };
            })();

            const promptWithTopics = (() => {
                const trimmedPrompt = form.generationPrompt.trim();
                const sections: string[] = [trimmedPrompt];

                if (form.mode === 'variant') {
                    const contextLines: string[] = [];
                    const baseSource = selectedBase ?? presetVariant ?? null;

                    if (baseSource) {
                        if (baseSource.questionDescription) {
                            contextLines.push(`Base question description: ${baseSource.questionDescription}`);
                        }
                        if (baseSource.variant?.questionText) {
                            contextLines.push(`Existing variant text: ${baseSource.variant.questionText}`);
                        }
                    }

                    if (contextLines.length > 0) {
                        sections.push(`Base question context:\n${contextLines.join('\n')}`);
                    }
                }

                if (topics.length > 0) {
                    const topicLines = topics.map((topic) => `- [${topic.id}] ${topic.name}`).join('\n');
                    sections.push(
                        `Course topics:\n${topicLines}\n\nUse these numeric IDs for "primary_topic_id" and "secondary_topic_ids".`
                    );
                }

                return sections.filter(Boolean).join('\n\n');
            })();

            const response = await eduaiService.generateQuestions({
                prompt: promptWithTopics,
                courseCode,
                model: form.generationModel,
                numQuestions: 1,
                difficultyDistribution,
                apiKeys: form.generationModel.startsWith('ollama')
                    ? { ollama: { isEnabled: true } }
                    : {}
            });

            const generated = response?.data?.questions?.[0];
            if (!generated) {
                throw new Error('EduAI did not return a question. Try a different prompt.');
            }

            const inferredType: QuestionType =
                generated.type === 'SA' || generated.type === 'MCQ' || generated.type === 'LA'
                    ? generated.type
                    : 'MCQ';
            const inferredDifficulty: QuestionDifficulty =
                generated.difficulty === 'easy' || generated.difficulty === 'hard'
                    ? generated.difficulty
                    : 'medium';

            setForm((prev) => {
                const topicIdSet = new Set(topics.map((topic) => topic.id));
                const primaryCandidate = Number(generated.primary_topic_id);
                const primaryTopicNumeric =
                    Number.isInteger(primaryCandidate) && topicIdSet.has(primaryCandidate)
                        ? primaryCandidate
                        : null;

                const resolvedSecondaryTopics = Array.isArray(generated.secondary_topic_ids)
                    ? Array.from(
                          new Set(
                              generated.secondary_topic_ids
                                  .map((value: unknown) => Number(value))
                                  .filter(
                                      (value) =>
                                          Number.isInteger(value) &&
                                          topicIdSet.has(value) &&
                                          value !== primaryTopicNumeric
                                  )
                          )
                      )
                    : [];

                if (prev.mode === 'variant') {
                    return {
                        ...prev,
                        variantText: generated.content ?? prev.variantText,
                        variantDifficulty: inferredDifficulty,
                        generationPrompt: prev.generationPrompt,
                        variantSecondaryTopics:
                            resolvedSecondaryTopics.length > 0 ? resolvedSecondaryTopics : prev.variantSecondaryTopics
                    };
                }

                const resolvedPrimaryTopicId =
                    primaryTopicNumeric !== null ? primaryTopicNumeric.toString() : prev.primaryTopicId;

                const resolvedDescription =
                    typeof generated.description === 'string' && generated.description.trim().length > 0
                        ? generated.description.trim()
                        : prev.questionDescription.trim() || createDescriptionFromText(generated.content ?? '');

                return {
                    ...prev,
                    questionType: inferredType,
                    variantText: generated.content ?? prev.variantText,
                    variantDifficulty: inferredDifficulty,
                    questionDescription: resolvedDescription,
                    generationPrompt: prev.generationPrompt,
                    variantReferenceId: '',
                    variantAnswer: '',
                    primaryTopicId: resolvedPrimaryTopicId,
                    variantSecondaryTopics:
                        resolvedSecondaryTopics.length > 0 ? resolvedSecondaryTopics : prev.variantSecondaryTopics
                };
            });

            toast({
                title: 'Question generated',
                description: 'Review the generated text and adjust any details before saving.'
            });
        } catch (generateError: any) {
            console.error('EduAI generation failed', generateError);
            const message =
                generateError?.response?.data?.error ||
                generateError?.message ||
                'Failed to generate question.';
            setError(message);
            toast({
                variant: 'destructive',
                title: 'EduAI generation failed',
                description: message
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSubmit = async () => {
        try {
            setIsSubmitting(true);
            setError(null);

            if (!courseId) {
                throw new Error('Select a course before adding a question.');
            }

            if (!form.variantText.trim()) {
                throw new Error('Variant question text is required.');
            }

            if (form.mode === 'variant') {
                if (!form.baseSelection) {
                    throw new Error('Please select an existing variant to base this on.');
                }
                const [questionIdStr] = form.baseSelection.split(':');
                const questionId = parseNumber(questionIdStr);
                if (!questionId) {
                    throw new Error('Invalid base question selection.');
                }

                await questionService.createVariant(questionId, {
                    questionText: form.variantText.trim(),
                    difficulty: form.variantDifficulty,
                    answer: form.variantAnswer.trim() || null,
                    assessmentId: form.variantAssessmentId === 'none' ? undefined : parseNumber(form.variantAssessmentId),
                    secondaryTopicsId: form.variantSecondaryTopics.length ? form.variantSecondaryTopics : undefined,
                    referenceId: parseNumber(form.variantReferenceId)
                });

                const updated = await questionService.getQuestion(questionId);
                onQuestionCreated(updated);
                onClose();
                return;
            }

            let description = form.questionDescription.trim();
            if (!description) {
                description = createDescriptionFromText(form.variantText);
                if (!description) {
                    throw new Error('Question description is required.');
                }
            }

            const primaryTopicId = parseNumber(form.primaryTopicId);
            if (!primaryTopicId) {
                throw new Error('Valid primary topic is required.');
            }

            let questionOrder: Record<string, number> | undefined;
            if (form.questionOrder) {
                try {
                    questionOrder = JSON.parse(form.questionOrder);
                } catch (parseError) {
                    throw new Error('Question order must be valid JSON.');
                }
            }

            const createdQuestion = await questionService.createQuestion({
                description,
                courseId,
                primaryTopicId,
                type: form.questionType,
                questionOrder
            });

            await questionService.createVariant(createdQuestion.id, {
                questionText: form.variantText.trim(),
                difficulty: form.variantDifficulty,
                answer: form.variantAnswer.trim() || null,
                assessmentId: form.variantAssessmentId === 'none' ? undefined : parseNumber(form.variantAssessmentId),
                secondaryTopicsId: form.variantSecondaryTopics.length ? form.variantSecondaryTopics : undefined,
                referenceId: parseNumber(form.variantReferenceId)
            });

            const hydrated = await questionService.getQuestion(createdQuestion.id);
            onQuestionCreated(hydrated);
            onClose();
        } catch (err: any) {
            let message = err?.message || 'Failed to save question.';
            if (err?.response?.data?.error) {
                message = err.response.data.error;
            }
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{form.mode === 'new' ? 'Create Question' : 'Add Variant'}</DialogTitle>
                </DialogHeader>

                <ScrollArea className="h-[60vh] pr-4">
                    <div className="space-y-6">
                        <div>
                            <Label className="text-sm font-semibold">What would you like to do?</Label>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    variant={form.mode === 'new' ? 'default' : 'outline'}
                                    onClick={() => setForm((prev) => ({ ...prev, mode: 'new', baseSelection: '' }))}
                                >
                                    Create new question
                                </Button>
                                <Button
                                    type="button"
                                    variant={form.mode === 'variant' ? 'default' : 'outline'}
                                    onClick={() => setForm((prev) => ({ ...prev, mode: 'variant' }))}
                                    disabled={baseVariantOptions.length === 0}
                                >
                                    Add variant to existing question
                                </Button>
                            </div>
                            {form.mode === 'variant' && baseVariantOptions.length === 0 && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                    No existing variants available. Create a new question first.
                                </p>
                            )}
                        </div>

                        {form.mode === 'variant' && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="base-question">Base Variant</Label>
                                    <Select
                                        value={form.baseSelection}
                                        onValueChange={(value) => {
                                            const entry = baseVariantOptions.find((option) => option.value === value)?.entry;
                                            if (entry) {
                                                const referenceId = entry.variant.referenceId ?? entry.variant.id;
                                                setForm((prev) => ({
                                                    ...prev,
                                                    baseSelection: value,
                                                    variantReferenceId: referenceId ? referenceId.toString() : '',
                                                    variantDifficulty: entry.variant.difficulty ?? 'medium',
                                                    variantSecondaryTopics: entry.variant.secondaryTopicsId || [],
                                                    variantAssessmentId: entry.variant.assessmentId ? entry.variant.assessmentId.toString() : 'none'
                                                }));
                                            } else {
                                                setForm((prev) => ({
                                                    ...prev,
                                                    baseSelection: value,
                                                    variantReferenceId: '',
                                                    variantSecondaryTopics: [],
                                                    variantAssessmentId: 'none'
                                                }));
                                            }
                                        }}
                                    >
                                        <SelectTrigger id="base-question">
                                            <SelectValue placeholder="Select an existing variant" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {baseVariantOptions.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {selectedBase && (
                                    <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
                                        <p>
                                            <span className="font-medium text-foreground">Parent question:</span>{' '}
                                            {selectedBase.questionDescription}
                                        </p>
                                        <p>
                                            <span className="font-medium text-foreground">Primary topic:</span>{' '}
                                            {topics.find((topic) => topic.id === selectedBase.primaryTopicId)?.name || `#${selectedBase.primaryTopicId}`}
                                        </p>
                                        <p className="text-xs italic text-foreground/60">Reference variant ID is auto-populated (dev only).</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {form.mode === 'new' && (
                            <div className="space-y-4">
                                <div className="space-y-2 rounded-md border bg-muted/30 p-4">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <Label className="text-sm font-semibold">Generate with EduAI</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Provide a topic or concept and let EduAI draft the question. You can edit the
                                                result before saving.
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            onClick={handleGenerateWithAI}
                                            disabled={isGenerating}
                                        >
                                            {isGenerating ? 'Generating…' : 'Generate Question'}
                                        </Button>
                                    </div>
                                    <div className="space-y-2 pt-2">
                                        {courseWarningMessage && (
                                            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                                                {courseWarningMessage}
                                            </div>
                                        )}
                                        <Label htmlFor="generation-prompt">Topic / Prompt</Label>
                                        <Textarea
                                            id="generation-prompt"
                                            value={form.generationPrompt}
                                            onChange={(event) => handleFieldChange('generationPrompt', event.target.value)}
                                            placeholder="e.g. Analyze the time complexity of quicksort."
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label>Model</Label>
                                            <Select
                                                value={form.generationModel}
                                                onValueChange={(value) => handleFieldChange('generationModel', value)}
                                                disabled={availableModels.length === 0}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a model" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableModels.length === 0 ? (
                                                        <SelectItem value="__no_models" disabled>
                                                            No models available yet
                                                        </SelectItem>
                                                    ) : (
                                                        availableModels.map((model) => (
                                                            <SelectItem key={model.id} value={model.id}>
                                                                {model.label}
                                                                {model.provider ? ` (${model.provider})` : ''}
                                                            </SelectItem>
                                                        ))
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Desired Difficulty</Label>
                                            <Select
                                                value={form.generationDifficulty}
                                                onValueChange={(value) =>
                                                    handleFieldChange(
                                                        'generationDifficulty',
                                                        (value as QuestionDifficulty | 'balanced')
                                                    )
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="balanced">Let EduAI decide</SelectItem>
                                                    <SelectItem value="easy">Easy</SelectItem>
                                                    <SelectItem value="medium">Medium</SelectItem>
                                                    <SelectItem value="hard">Hard</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="question-type">Question Type</Label>
                                    <Select
                                        value={form.questionType}
                                        onValueChange={(value) => handleFieldChange('questionType', value as QuestionType)}
                                    >
                                        <SelectTrigger id="question-type">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {questionTypes.map((type) => (
                                                <SelectItem key={type} value={type} className="uppercase">
                                                    {questionTypeLabels[type]}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="primary-topic">Primary Topic</Label>
                                    <Select
                                        value={form.primaryTopicId}
                                        onValueChange={(value) => handleFieldChange('primaryTopicId', value)}
                                        disabled={topics.length === 0}
                                    >
                                        <SelectTrigger id="primary-topic">
                                            <SelectValue placeholder={topics.length === 0 ? 'No topics available' : 'Select a topic'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {topics.length === 0 ? (
                                                <SelectItem value="__no_topics" disabled>
                                                    {isAuxLoading ? 'Loading topics...' : 'No topics available'}
                                                </SelectItem>
                                            ) : (
                                                topics.map((topic) => (
                                                    <SelectItem key={topic.id} value={topic.id.toString()}>
                                                        {topic.name} (#{topic.id})
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="question-description">Question Description</Label>
                                    <Textarea
                                        id="question-description"
                                        value={form.questionDescription}
                                        onChange={(event) => handleFieldChange('questionDescription', event.target.value)}
                                        placeholder="Enter the question prompt"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="question-order">Question Order (JSON)</Label>
                                    <Input
                                        id="question-order"
                                        value={form.questionOrder}
                                        onChange={(event) => handleFieldChange('questionOrder', event.target.value)}
                                        placeholder='Optional e.g. {"assessmentId": order}'
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold">Variant Details</h4>

                            {form.mode === 'variant' && (
                                <div className="space-y-3 rounded-md border bg-muted/30 p-4">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="space-y-1">
                                            <Label className="text-sm font-semibold">Generate Variant with EduAI</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Describe how you want to tweak this question and let EduAI draft a new variant.
                                                {selectedBase && (
                                                    <>
                                                        {' '}
                                                        The base question is &ldquo;{selectedBase.questionDescription}&rdquo;.
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            onClick={handleGenerateWithAI}
                                            disabled={isGenerating}
                                        >
                                            {isGenerating ? 'Generating…' : 'Generate Variant'}
                                        </Button>
                                    </div>

                                    {courseWarningMessage && (
                                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                                            {courseWarningMessage}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="variant-generation-prompt">Variant Prompt</Label>
                                        <Textarea
                                            id="variant-generation-prompt"
                                            value={form.generationPrompt}
                                            onChange={(event) =>
                                                handleFieldChange('generationPrompt', event.target.value)
                                            }
                                            placeholder="e.g. Create a harder twist that focuses on application rather than recall."
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label>Model</Label>
                                            <Select
                                                value={form.generationModel}
                                                onValueChange={(value) => handleFieldChange('generationModel', value)}
                                                disabled={availableModels.length === 0}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a model" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableModels.length === 0 ? (
                                                        <SelectItem value="__no_models" disabled>
                                                            No models available yet
                                                        </SelectItem>
                                                    ) : (
                                                        availableModels.map((model) => (
                                                            <SelectItem key={model.id} value={model.id}>
                                                                {model.label}
                                                                {model.provider ? ` (${model.provider})` : ''}
                                                            </SelectItem>
                                                        ))
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Desired Difficulty</Label>
                                            <Select
                                                value={form.generationDifficulty}
                                                onValueChange={(value) =>
                                                    handleFieldChange(
                                                        'generationDifficulty',
                                                        value as QuestionDifficulty | 'balanced'
                                                    )
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="balanced">Let EduAI decide</SelectItem>
                                                    <SelectItem value="easy">Easy</SelectItem>
                                                    <SelectItem value="medium">Medium</SelectItem>
                                                    <SelectItem value="hard">Hard</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="variant-text">Variant Question Text</Label>
                                <Textarea
                                    id="variant-text"
                                    value={form.variantText}
                                    onChange={(event) => handleFieldChange('variantText', event.target.value)}
                                    placeholder="Enter the question wording"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="variant-difficulty">Difficulty</Label>
                                    <Select
                                        value={form.variantDifficulty}
                                        onValueChange={(value) => handleFieldChange('variantDifficulty', value as QuestionDifficulty)}
                                    >
                                        <SelectTrigger id="variant-difficulty">
                                            <SelectValue placeholder="Select difficulty" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {difficultyOptions.map((option) => (
                                                <SelectItem key={option} value={option} className="capitalize">
                                                    {option}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="variant-reference">Reference Variant ID <span className="text-xs text-muted-foreground">(dev only)</span></Label>
                                    <Input
                                        id="variant-reference"
                                        value={form.variantReferenceId}
                                        placeholder="Auto-assigned"
                                        readOnly
                                        className="bg-muted/50"
                                    />
                                    <p className="text-xs text-muted-foreground">Automatically populated when you select a base variant. Not editable.</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="variant-answer">Answer (optional)</Label>
                                <Textarea
                                    id="variant-answer"
                                    value={form.variantAnswer}
                                    onChange={(event) => handleFieldChange('variantAnswer', event.target.value)}
                                    placeholder="Provide an answer or leave blank"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="variant-assessment">Assessment (optional)</Label>
                                    <Select
                                        value={form.variantAssessmentId}
                                        onValueChange={(value) => handleFieldChange('variantAssessmentId', value)}
                                    >
                                        <SelectTrigger id="variant-assessment">
                                            <SelectValue placeholder="Select assessment" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No assessment</SelectItem>
                                            {assessmentOptions.length === 0 ? (
                                                <SelectItem value="__no_assessments" disabled>
                                                    {isAuxLoading ? 'Loading...' : 'No assessments available'}
                                                </SelectItem>
                                            ) : (
                                                assessmentOptions.map((assessment) => (
                                                    <SelectItem key={assessment.id} value={assessment.id.toString()}>
                                                        {assessment.name} ({assessment.type})
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Secondary Topics (optional)</Label>
                                    <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-auto">
                                        {topics.length === 0 ? (
                                            <p className="text-xs text-muted-foreground">
                                                {isAuxLoading ? 'Loading topics...' : 'No topics available for this course.'}
                                            </p>
                                        ) : (
                                            topics.map((topic) => {
                                                const checked = form.variantSecondaryTopics.includes(topic.id);
                                                const isPrimary = form.primaryTopicId === topic.id.toString();
                                                return (
                                                    <label
                                                        key={topic.id}
                                                        className={`flex items-center space-x-2 text-sm ${
                                                            isPrimary ? 'text-muted-foreground/70' : 'text-foreground'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            className="h-4 w-4"
                                                            checked={checked}
                                                            disabled={isPrimary}
                                                            onChange={(event) => toggleSecondaryTopic(topic.id, event.target.checked)}
                                                        />
                                                        <span>{topic.name} (#{topic.id})</span>
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {error && <p className="text-sm text-destructive">{error}</p>}
                    </div>
                </ScrollArea>

                <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={
                            isSubmitting ||
                            (form.mode === 'variant' && baseVariantOptions.length === 0) ||
                            (form.mode === 'variant' && !form.baseSelection)
                        }
                    >
                        {isSubmitting ? 'Saving...' : form.mode === 'new' ? 'Create Question' : 'Add Variant'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
