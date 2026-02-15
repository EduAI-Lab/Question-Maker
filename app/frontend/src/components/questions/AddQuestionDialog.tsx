/**
 * Dialog for creating questions (manual or AI-assisted) and managing initial variants.
 * Handles course/topic selection, validation, assessment linkage, and optional AI generation hooks.
 */
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
    QuestionVariantEntry,
    ReasoningLevel,
    MCQChoice
} from '../../types/question';
import { MCQChoicesField } from './MCQChoicesField';
import { questionService } from '../../services/questionService';
import { courseService } from '../../services/courseService';
import assessmentService from '../../services/assessmentService';
import { Assessment } from '../../types/question';
import { Topic } from '../../types/topic';
import { useToast } from '../ui/use-toast';
import { ToastAction } from '../ui/toast';
import eduaiService, { EduAIModelOption, EduAICourseOption } from '../../services/eduaiService';
import { Course } from '../../types/question';
import { apiKeyStorage } from '../../services/apiKeyStorage';
import { useEduAIStatus } from '../../hooks/useEduAIStatus';
import { EduAIStatusBadge } from '../eduai/EduAIStatusBadge';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Tooltip } from '../ui/tooltip';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

interface AddQuestionDialogProps {
    open: boolean;
    onClose: () => void;
    courseId?: number | null;
    variants: QuestionVariantEntry[];
    onQuestionCreated: (question: Question) => void;
    presetVariant?: QuestionVariantEntry | null;
    /** When 0, show a flashing hint on the guided-tour button to draw new users. */
    totalQuestionsInBank?: number;
}

type FormState = {
    baseSelection: string; // encoded as `${questionId}:${variantId}`
    variantText: string;
    variantDifficulty: QuestionDifficulty;
    variantReasoningLevel: ReasoningLevel;
    variantAnswer: string;
    variantChoices: MCQChoice[];
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
    generationReasoningLevel: ReasoningLevel | 'balanced';
};

const defaultForm: FormState = {
    baseSelection: '',
    variantText: '',
    variantDifficulty: 'medium',
    variantReasoningLevel: 'factual',
    variantAnswer: '',
    variantChoices: [{ letter: 'A', text: '' }, { letter: 'B', text: '' }, { letter: 'C', text: '' }, { letter: 'D', text: '' }],
    variantSecondaryTopics: [],
    variantAssessmentId: 'none',
    variantReferenceId: '',
    questionType: 'MCQ',
    questionDescription: '',
    primaryTopicId: '',
    questionOrder: '',
    generationPrompt: '',
    generationModel: 'ollama:gpt-oss:120b',
    generationDifficulty: 'balanced',
    generationReasoningLevel: 'balanced'
};

const difficultyOptions: QuestionDifficulty[] = ['easy', 'medium', 'hard'];
const reasoningLevelOptions: ReasoningLevel[] = ['factual', 'analytical', 'application'];
const reasoningLevelLabels: Record<ReasoningLevel, string> = {
    factual: 'Factual',
    analytical: 'Analytical',
    application: 'Application'
};
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
    presetVariant,
    totalQuestionsInBank
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
    const [providerApiKey, setProviderApiKey] = useState('');
    const [availableEduCourses, setAvailableEduCourses] = useState<EduAICourseOption[]>([]);
    const [isAiGenerated, setIsAiGenerated] = useState(false);
    const [markAsReviewed, setMarkAsReviewed] = useState(false); // false = draft (default), true = reviewed
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [errorModalMessage, setErrorModalMessage] = useState<string>('');
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [modalTourOpen, setModalTourOpen] = useState(false);
    const [modalTourStepIndex, setModalTourStepIndex] = useState(0);
    const { toast } = useToast();
    const showNewUserHint = totalQuestionsInBank === 0;

    const modalTourSteps = useMemo<{ id: string; content: string }[]>(() => [
        { id: 'aq-form-fields', content: 'To create a question manually, fill out the form on the left.' },
        { id: 'aq-draft-toggle', content: 'Mark as reviewed.' },
        { id: 'aq-save', content: 'Save.' },
        { id: 'aq-eduai-panel', content: 'To create a question with AI, use the panel on the right.' },
        { id: 'aq-ai-prompt', content: 'Write out your prompt for how you would like your variant.' },
        { id: 'aq-model-picker', content: 'Select model, difficulty focus and reasoning level.' },
        { id: 'aq-ai-generate', content: 'Click Generate, then wait 30–60 seconds for your question to be generated.' },
        { id: 'aq-form-fields', content: 'Review the generated question.' },
        { id: 'aq-save', content: 'Save.' }
    ], []);

    const [tourHighlightRect, setTourHighlightRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
    const currentStepId = modalTourSteps[modalTourStepIndex]?.id;

    useLayoutEffect(() => {
        if (!modalTourOpen || currentStepId == null) {
            setTourHighlightRect(null);
            return;
        }
        const target = document.querySelector(`[data-tour-id="${currentStepId}"]`) as HTMLElement | null;
        if (!target) {
            setTourHighlightRect(null);
            return;
        }
        const updateRect = () => {
            const rect = target.getBoundingClientRect();
            setTourHighlightRect({
                top: rect.top - 4,
                left: rect.left - 4,
                width: rect.width + 8,
                height: rect.height + 8
            });
        };
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        updateRect();
        const observer = new ResizeObserver(updateRect);
        observer.observe(target);
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect, true);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect, true);
        };
    }, [modalTourOpen, currentStepId]);
    const eduaiStatus = useEduAIStatus();
    const selectedGenerationModel = useMemo(
        () => availableModels.find((model) => model.id === form.generationModel),
        [availableModels, form.generationModel]
    );
    const isExternalGenerationModel = useMemo(
        () => (selectedGenerationModel ? selectedGenerationModel.provider !== 'ollama' : !form.generationModel.startsWith('ollama')),
        [form.generationModel, selectedGenerationModel]
    );

    // Derive mode from presetVariant prop
    const mode: 'new' | 'variant' = presetVariant ? 'variant' : 'new';

    useEffect(() => {
        if (!open) {
            setForm(defaultForm);
            setError(null);
            setTopics([]);
            setAssessments([]);
            setCourseDetails(null);
            setIsGenerating(false);
            setIsAiGenerated(false);
            setMarkAsReviewed(false);
            setModalTourOpen(false);
            setModalTourStepIndex(0);
            return;
        }

        if (presetVariant) {
            const referenceId = presetVariant.variant.referenceId ?? presetVariant.variant.id;
            setForm({
                ...defaultForm,
                baseSelection: `${presetVariant.questionId}:${presetVariant.variant.id}`,
                variantReferenceId: referenceId ? referenceId.toString() : '',
                variantDifficulty: presetVariant.variant.difficulty ?? 'medium',
                variantReasoningLevel: presetVariant.variant.reasoningLevel ?? 'factual',
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

    // Load API key when model changes
    useEffect(() => {
        if (!form.generationModel) return;

        const loadApiKey = async () => {
            const provider = apiKeyStorage.getProviderFromModel(form.generationModel);
            if (provider) {
                const savedKey = await apiKeyStorage.getApiKey(provider);
                setProviderApiKey(savedKey || '');
            } else {
                setProviderApiKey('');
            }
        };

        void loadApiKey();
    }, [form.generationModel]);

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

    const handleCopyFromVariant = (variantEntry: QuestionVariantEntry) => {
        // Handle choices for MCQ
        let copiedChoices: MCQChoice[] = [{ letter: 'A', text: '' }, { letter: 'B', text: '' }, { letter: 'C', text: '' }, { letter: 'D', text: '' }];
        if (variantEntry.questionType === 'MCQ' && variantEntry.variant.choices && Array.isArray(variantEntry.variant.choices) && variantEntry.variant.choices.length > 0) {
            copiedChoices = variantEntry.variant.choices.map(c => ({ ...c }));
            // Ensure at least 4 choices for display
            while (copiedChoices.length < 4) {
                const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                copiedChoices.push({ letter: letters[copiedChoices.length], text: '' });
            }
        }
        const referenceId = variantEntry.variant.referenceId ?? variantEntry.variant.id;
        setForm((prev) => ({
            ...prev,
            baseSelection: `${variantEntry.questionId}:${variantEntry.variant.id}`,
            variantText: variantEntry.variant.questionText,
            variantDifficulty: variantEntry.variant.difficulty ?? 'medium',
            variantReasoningLevel: variantEntry.variant.reasoningLevel ?? 'factual',
            variantAnswer: variantEntry.variant.answer || '',
            variantChoices: copiedChoices,
            variantSecondaryTopics: variantEntry.variant.secondaryTopicsId || [],
            variantAssessmentId: variantEntry.variant.assessmentId ? variantEntry.variant.assessmentId.toString() : 'none',
            variantReferenceId: referenceId ? referenceId.toString() : ''
        }));
        toast({
            title: 'Fields copied',
            description: 'Variant fields have been copied. You can now edit them before saving.'
        });
    };

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

            const reasoningDistribution = (() => {
                if (form.generationReasoningLevel === 'balanced') {
                    return { factual: 33, analytical: 33, application: 34 };
                }
                return {
                    factual: form.generationReasoningLevel === 'factual' ? 100 : 0,
                    analytical: form.generationReasoningLevel === 'analytical' ? 100 : 0,
                    application: form.generationReasoningLevel === 'application' ? 100 : 0
                };
            })();

            const promptWithTopics = (() => {
                const trimmedPrompt = form.generationPrompt.trim();
                const sections: string[] = [trimmedPrompt];

                if (mode === 'variant') {
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

            const apiKeys = await apiKeyStorage.buildApiKeysForModel(form.generationModel);
            const response = await eduaiService.generateQuestions({
                prompt: promptWithTopics,
                courseCode,
                model: form.generationModel,
                numQuestions: 1,
                difficultyDistribution,
                reasoningDistribution,
                apiKeys
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
            const inferredReasoningLevel: ReasoningLevel =
                generated.reasoning_level === 'analytical' || generated.reasoning_level === 'application'
                    ? generated.reasoning_level
                    : 'factual';

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

                const resolvedAnswer =
                    typeof generated.answer === 'string' && generated.answer.trim().length > 0
                        ? generated.answer.trim()
                        : '';

                // Handle choices for MCQ questions
                let resolvedChoices: MCQChoice[] = prev.variantChoices;
                if (inferredType === 'MCQ' && Array.isArray(generated.choices) && generated.choices.length > 0) {
                    resolvedChoices = generated.choices.map((c: any) => ({
                        letter: typeof c.letter === 'string' ? c.letter.toUpperCase() : c.letter,
                        text: typeof c.text === 'string' ? c.text.trim() : String(c.text || '')
                    })).filter((c: MCQChoice) => c.text.length > 0);
                    // Ensure at least 2 choices
                    if (resolvedChoices.length < 2) {
                        resolvedChoices = prev.variantChoices;
                    }
                } else if (inferredType !== 'MCQ') {
                    // Reset choices for non-MCQ
                    resolvedChoices = [{ letter: 'A', text: '' }, { letter: 'B', text: '' }, { letter: 'C', text: '' }, { letter: 'D', text: '' }];
                }

                if (mode === 'variant') {
                    return {
                        ...prev,
                        variantText: generated.content ?? prev.variantText,
                        variantDifficulty: inferredDifficulty,
                        variantReasoningLevel: inferredReasoningLevel,
                        variantAnswer: resolvedAnswer || prev.variantAnswer,
                        variantChoices: resolvedChoices,
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
                    variantReasoningLevel: inferredReasoningLevel,
                    questionDescription: resolvedDescription,
                    generationPrompt: prev.generationPrompt,
                    variantReferenceId: '',
                    variantAnswer: resolvedAnswer,
                    variantChoices: resolvedChoices,
                    primaryTopicId: resolvedPrimaryTopicId,
                    variantSecondaryTopics:
                        resolvedSecondaryTopics.length > 0 ? resolvedSecondaryTopics : prev.variantSecondaryTopics
                };
            });

            setIsAiGenerated(true);
            toast({
                title: 'Question generated',
                description: 'Review the generated text and adjust any details before saving.'
            });
        } catch (generateError: any) {
            console.error('EduAI generation failed', generateError);
            // Prioritize AI-provided error reason (from details field) over generic error message
            const aiErrorReason = generateError?.response?.data?.aiErrorReason;
            const details = generateError?.response?.data?.details;
            const errorMessage = generateError?.response?.data?.error;
            const message =
                aiErrorReason ||
                details ||
                errorMessage ||
                generateError?.message ||
                'Failed to generate question.';
            setError(message);
            
            // Store the error message for the modal
            setErrorModalMessage(message);
            
            // Show a persistent toast with a click action to view details
            toast({
                variant: 'destructive',
                title: 'EduAI has thrown an error',
                description: 'Click to see why',
                duration: Infinity, // Prevent auto-dismissal - user must manually dismiss
                action: (
                    <ToastAction
                        altText="View error details"
                        onClick={() => setErrorModalOpen(true)}
                    >
                        View Details
                    </ToastAction>
                )
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

            if (mode === 'variant') {
                if (!form.baseSelection) {
                    throw new Error('Please select an existing variant to base this on.');
                }
                const [questionIdStr] = form.baseSelection.split(':');
                const questionId = parseNumber(questionIdStr);
                if (!questionId) {
                    throw new Error('Invalid base question selection.');
                }

                // Validate MCQ choices
                let choices: MCQChoice[] | null = null;
                if (presetVariant?.questionType === 'MCQ') {
                    const validChoices = form.variantChoices.filter(c => c.text.trim().length > 0);
                    if (validChoices.length < 2) {
                        throw new Error('MCQ questions require at least 2 choices with text.');
                    }
                    choices = validChoices;
                }

                await questionService.createVariant(questionId, {
                    questionText: form.variantText.trim(),
                    difficulty: form.variantDifficulty,
                    reasoningLevel: form.variantReasoningLevel,
                    answer: form.variantAnswer.trim() || null,
                    choices: choices,
                    assessmentId: form.variantAssessmentId === 'none' ? undefined : parseNumber(form.variantAssessmentId),
                    secondaryTopicsId: form.variantSecondaryTopics.length ? form.variantSecondaryTopics : undefined,
                    referenceId: parseNumber(form.variantReferenceId),
                    isAiGenerated,
                    isDraft: !markAsReviewed
                });

                const updated = await questionService.getQuestion(questionId);
                onQuestionCreated(updated);
                onClose();
                return;
            }

            const description = form.questionDescription.trim()
                || createDescriptionFromText(form.variantText)
                || null;

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

            // Ensure isAiGenerated is set correctly - if AI generation was used, it should be true
            const shouldMarkAsAiGenerated = isAiGenerated === true;

            const createdQuestion = await questionService.createQuestion({
                description: description || undefined,
                courseId,
                primaryTopicId,
                type: form.questionType,
                questionOrder
            });

            // Validate MCQ choices
            let choices: MCQChoice[] | null = null;
            if (form.questionType === 'MCQ') {
                const validChoices = form.variantChoices.filter(c => c.text.trim().length > 0);
                if (validChoices.length < 2) {
                    throw new Error('MCQ questions require at least 2 choices with text.');
                }
                choices = validChoices;
            }

            await questionService.createVariant(createdQuestion.id, {
                questionText: form.variantText.trim(),
                difficulty: form.variantDifficulty,
                reasoningLevel: form.variantReasoningLevel,
                answer: form.variantAnswer.trim() || null,
                choices: choices,
                assessmentId: form.variantAssessmentId === 'none' ? undefined : parseNumber(form.variantAssessmentId),
                secondaryTopicsId: form.variantSecondaryTopics.length ? form.variantSecondaryTopics : undefined,
                referenceId: parseNumber(form.variantReferenceId),
                isAiGenerated: shouldMarkAsAiGenerated,
                isDraft: !markAsReviewed // Inverted: if marked as reviewed, then NOT a draft
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
            <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-6xl">
                <DialogHeader>
                    <div className="flex items-center justify-between gap-4">
                        <DialogTitle>
                            {mode === 'new'
                                ? 'Create New Question'
                                : `Add Variant: ${presetVariant?.questionDescription ?? 'Question'}`}
                        </DialogTitle>
                        <Tooltip content="Walk through manual and AI workflows" side="left">
                            <div className="relative flex-shrink-0">
                                {showNewUserHint && (
                                    <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                                    </span>
                                )}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9"
                                    onClick={() => {
                                        setModalTourStepIndex(0);
                                        setModalTourOpen(true);
                                    }}
                                    aria-label="Open workflow guide"
                                >
                                    <HelpCircle className="h-5 w-5" />
                                </Button>
                            </div>
                        </Tooltip>
                    </div>
                </DialogHeader>

                {modalTourOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-[100] bg-black/50"
                            onClick={() => setModalTourOpen(false)}
                            aria-hidden="true"
                        />
                        {tourHighlightRect && (
                            <div
                                className="fixed z-[101] rounded-lg border-2 border-blue-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none transition-all duration-200"
                                style={{
                                    top: tourHighlightRect.top,
                                    left: tourHighlightRect.left,
                                    width: tourHighlightRect.width,
                                    height: tourHighlightRect.height
                                }}
                            />
                        )}
                        <div
                            className="fixed z-[102] w-[320px] max-w-[calc(100vw-2rem)] pointer-events-auto"
                            style={(() => {
                                const pad = 12;
                                const tw = 320;
                                const th = 160;
                                if (!tourHighlightRect) {
                                    return {
                                        top: window.innerHeight / 2 - th / 2,
                                        left: Math.max(pad, Math.min(window.innerWidth - tw - pad, window.innerWidth / 2 - tw / 2))
                                    };
                                }
                                const belowTop = tourHighlightRect.top + tourHighlightRect.height + pad;
                                const aboveBottom = tourHighlightRect.top - pad - th;
                                const top = belowTop + th <= window.innerHeight - pad ? belowTop : aboveBottom >= pad ? aboveBottom : pad;
                                const left = Math.max(pad, Math.min(window.innerWidth - tw - pad, tourHighlightRect.left + tourHighlightRect.width / 2 - tw / 2));
                                return { top, left };
                            })()}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="rounded-lg border bg-background p-4 shadow-xl">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <p className="text-sm text-foreground leading-relaxed flex-1">
                                        {modalTourSteps[modalTourStepIndex]?.content}
                                    </p>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted-foreground hover:text-foreground shrink-0 -mt-1 -mr-1"
                                        onClick={() => setModalTourOpen(false)}
                                    >
                                        Skip
                                    </Button>
                                </div>
                                <div className="flex justify-between items-center">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setModalTourStepIndex((i) => Math.max(0, i - 1))}
                                        disabled={modalTourStepIndex === 0}
                                    >
                                        Back
                                    </Button>
                                    {modalTourStepIndex === modalTourSteps.length - 1 ? (
                                        <Button type="button" size="sm" onClick={() => setModalTourOpen(false)}>
                                            Done
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => setModalTourStepIndex((i) => i + 1)}
                                        >
                                            Next
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                <div className="flex gap-6 h-[65vh]">
                    {/* LEFT PANEL: Question Details Form (75% width) */}
                    <div className="flex-[3] overflow-hidden">
                        <ScrollArea className="h-full pr-4">
                            <div className="space-y-6">
                                {mode === 'variant' && presetVariant && (
                                    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                                        <h4 className="text-sm font-semibold text-foreground">Base Question Info</h4>
                                        <p className="text-sm">
                                            <span className="font-medium">Description:</span>{' '}
                                            <span className="text-muted-foreground">{presetVariant.questionDescription ?? '—'}</span>
                                        </p>
                                        <p className="text-sm">
                                            <span className="font-medium">Primary Topic:</span>{' '}
                                            <span className="text-muted-foreground">
                                                {topics.find((t) => t.id === presetVariant.primaryTopicId)?.name ?? `#${presetVariant.primaryTopicId}`}
                                            </span>
                                        </p>
                                        <p className="text-sm">
                                            <span className="font-medium">Type:</span>{' '}
                                            <span className="text-muted-foreground">{questionTypeLabels[presetVariant.questionType]}</span>
                                        </p>
                                    </div>
                                )}

                                {/* New Question Mode: Base section + collapsible Advanced */}
                                {mode === 'new' && (
                                    <>
                                        <div className="space-y-4" data-tour-id="aq-metadata">
                                            <Tabs
                                                value={form.questionType}
                                                onValueChange={(value) => handleFieldChange('questionType', value as QuestionType)}
                                                className="w-full"
                                            >
                                                <TabsList className="grid w-full grid-cols-3 h-9">
                                                    <TabsTrigger value="MCQ" className="text-xs sm:text-sm">MCQ</TabsTrigger>
                                                    <TabsTrigger value="SA" className="text-xs sm:text-sm">Short Answer</TabsTrigger>
                                                    <TabsTrigger value="LA" className="text-xs sm:text-sm">Long Answer</TabsTrigger>
                                                </TabsList>
                                            </Tabs>

                                            <div className="space-y-4" data-tour-id="aq-form-fields">
                                                <div className="space-y-2">
                                                    <Label htmlFor="variant-text">Question Text</Label>
                                                    <Textarea
                                                        id="variant-text"
                                                        value={form.variantText}
                                                        onChange={(event) => handleFieldChange('variantText', event.target.value)}
                                                        placeholder={form.questionType === 'MCQ' ? "Enter the question text (without choices)" : "Enter the full question text"}
                                                        rows={6}
                                                    />
                                                </div>

                                                {form.questionType === 'MCQ' && (
                                                    <MCQChoicesField
                                                        choices={form.variantChoices ?? defaultForm.variantChoices}
                                                        answer={form.variantAnswer}
                                                        onChoicesChange={(choices) => handleFieldChange('variantChoices', choices)}
                                                        onAnswerChange={(answer) => handleFieldChange('variantAnswer', answer)}
                                                        idPrefix="aq-mcq"
                                                    />
                                                )}

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
                                                    <Label htmlFor="variant-reasoning-level">Reasoning Focus</Label>
                                                    <Select
                                                        value={form.variantReasoningLevel}
                                                        onValueChange={(value) => handleFieldChange('variantReasoningLevel', value as ReasoningLevel)}
                                                    >
                                                        <SelectTrigger id="variant-reasoning-level">
                                                            <SelectValue placeholder="Select reasoning focus" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {reasoningLevelOptions.map((option) => (
                                                                <SelectItem key={option} value={option}>
                                                                    {reasoningLevelLabels[option]}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border rounded-lg overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => setAdvancedOpen((o) => !o)}
                                                className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-left hover:bg-muted/50 transition-colors"
                                            >
                                                <span>Advanced Information</span>
                                                {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </button>
                                            {advancedOpen && (
                                                <div className="space-y-4 px-4 pb-4 pt-0 border-t" data-tour-id="aq-variant">
                                                    <div className="space-y-2 pt-4">
                                                        <Label htmlFor="question-description">Question Description <span className="text-xs text-muted-foreground">(optional)</span></Label>
                                                        <Textarea
                                                            id="question-description"
                                                            value={form.questionDescription}
                                                            onChange={(event) => handleFieldChange('questionDescription', event.target.value)}
                                                            placeholder="Short description or leave blank"
                                                            rows={2}
                                                        />
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
                                                    </div>
                                                    {form.questionType !== 'MCQ' && (
                                                        <div className="space-y-2">
                                                            <Label htmlFor="variant-answer">Answer <span className="text-xs text-muted-foreground">(optional)</span></Label>
                                                            <Textarea
                                                                id="variant-answer"
                                                                value={form.variantAnswer}
                                                                onChange={(event) => handleFieldChange('variantAnswer', event.target.value)}
                                                                placeholder="Provide an answer or leave blank"
                                                                rows={3}
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="variant-assessment">Assessment <span className="text-xs text-muted-foreground">(optional)</span></Label>
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
                                                            <Label>Secondary Topics <span className="text-xs text-muted-foreground">(optional)</span></Label>
                                                            <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-auto">
                                                                {topics.length === 0 ? (
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {isAuxLoading ? 'Loading topics...' : 'No topics available'}
                                                                    </p>
                                                                ) : (
                                                                    topics.map((topic) => {
                                                                        const checked = form.variantSecondaryTopics.includes(topic.id);
                                                                        const isPrimary = form.primaryTopicId === topic.id.toString();
                                                                        return (
                                                                            <label
                                                                                key={topic.id}
                                                                                className={`flex items-center space-x-2 text-sm ${isPrimary ? 'text-muted-foreground/70' : 'text-foreground'}`}
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="h-4 w-4"
                                                                                    checked={checked}
                                                                                    disabled={isPrimary}
                                                                                    onChange={(event) => toggleSecondaryTopic(topic.id, event.target.checked)}
                                                                                />
                                                                                <span>{topic.name}</span>
                                                                            </label>
                                                                        );
                                                                    })
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* Variant mode: same layout as new — Base + collapsible Advanced */}
                                {mode === 'variant' && (
                                    <>
                                        <div className="space-y-4" data-tour-id="aq-metadata">
                                            <div className="space-y-4" data-tour-id="aq-form-fields">
                                                <div className="space-y-2">
                                                    <Label htmlFor="variant-text">Question Text</Label>
                                                    <Textarea
                                                        id="variant-text"
                                                        value={form.variantText}
                                                        onChange={(event) => handleFieldChange('variantText', event.target.value)}
                                                        placeholder={form.questionType === 'MCQ' ? "Enter the question text" : "Enter the full question text"}
                                                        rows={6}
                                                    />
                                                </div>

                                                {form.questionType === 'MCQ' && (
                                                    <MCQChoicesField
                                                        choices={form.variantChoices ?? defaultForm.variantChoices}
                                                        answer={form.variantAnswer}
                                                        onChoicesChange={(choices) => handleFieldChange('variantChoices', choices)}
                                                        onAnswerChange={(answer) => handleFieldChange('variantAnswer', answer)}
                                                        idPrefix="aq-mcq"
                                                    />
                                                )}

                                                {presetVariant && (
                                                    <p className="text-sm text-muted-foreground">
                                                        <span className="font-medium">Primary topic:</span>{' '}
                                                        {topics.find((t) => t.id === presetVariant.primaryTopicId)?.name ?? `#${presetVariant.primaryTopicId}`}
                                                    </p>
                                                )}
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
                                                    <Label htmlFor="variant-reasoning-level">Reasoning Focus</Label>
                                                    <Select
                                                        value={form.variantReasoningLevel}
                                                        onValueChange={(value) => handleFieldChange('variantReasoningLevel', value as ReasoningLevel)}
                                                    >
                                                        <SelectTrigger id="variant-reasoning-level">
                                                            <SelectValue placeholder="Select reasoning focus" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {reasoningLevelOptions.map((option) => (
                                                                <SelectItem key={option} value={option}>
                                                                    {reasoningLevelLabels[option]}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border rounded-lg overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => setAdvancedOpen((o) => !o)}
                                                className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-left hover:bg-muted/50 transition-colors"
                                            >
                                                <span>Advanced Information</span>
                                                {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </button>
                                            {advancedOpen && (
                                                <div className="space-y-4 px-4 pb-4 pt-0 border-t" data-tour-id="aq-variant">
                                                    <div className="space-y-2 pt-4">
                                                        <Label htmlFor="variant-reference">Reference Variant ID <span className="text-xs text-muted-foreground">(dev only)</span></Label>
                                                        <Input
                                                            id="variant-reference"
                                                            value={form.variantReferenceId}
                                                            placeholder="Auto-assigned"
                                                            readOnly
                                                            className="bg-muted/50"
                                                        />
                                                    </div>
                                                    {form.questionType !== 'MCQ' && (
                                                        <div className="space-y-2">
                                                            <Label htmlFor="variant-answer">Answer <span className="text-xs text-muted-foreground">(optional)</span></Label>
                                                            <Textarea
                                                                id="variant-answer"
                                                                value={form.variantAnswer}
                                                                onChange={(event) => handleFieldChange('variantAnswer', event.target.value)}
                                                                placeholder="Provide an answer or leave blank"
                                                                rows={3}
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="variant-assessment">Assessment <span className="text-xs text-muted-foreground">(optional)</span></Label>
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
                                                            <Label>Secondary Topics <span className="text-xs text-muted-foreground">(optional)</span></Label>
                                                            <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-auto">
                                                                {topics.length === 0 ? (
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {isAuxLoading ? 'Loading topics...' : 'No topics available'}
                                                                    </p>
                                                                ) : (
                                                                    topics.map((topic) => {
                                                                        const checked = form.variantSecondaryTopics.includes(topic.id);
                                                                        const isPrimary = form.primaryTopicId === topic.id.toString();
                                                                        return (
                                                                            <label
                                                                                key={topic.id}
                                                                                className={`flex items-center space-x-2 text-sm ${isPrimary ? 'text-muted-foreground/70' : 'text-foreground'}`}
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="h-4 w-4"
                                                                                    checked={checked}
                                                                                    disabled={isPrimary}
                                                                                    onChange={(event) => toggleSecondaryTopic(topic.id, event.target.checked)}
                                                                                />
                                                                                <span>{topic.name}</span>
                                                                            </label>
                                                                        );
                                                                    })
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {error && <p className="text-sm text-destructive">{error}</p>}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* RIGHT PANEL: Helper Tools (25% width) */}
                    <div className="flex-[1] overflow-hidden border-l pl-6">
                        <ScrollArea className="h-full pr-2">
                            <div className="space-y-4">
                                <h4 className="text-sm font-semibold text-muted-foreground">How to Fill This Form</h4>

                                {/* Option 1: Copy from Base Variant */}
                                {mode === 'variant' && presetVariant && (
                                    <div className="rounded-lg border-2 border-muted bg-card p-4 space-y-3">
                                        <div className="flex items-start gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 text-blue-500">
                                                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                            </svg>
                                            <div className="flex-1">
                                                <h5 className="text-sm font-semibold">Copy from Base Variant</h5>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Auto-fill fields from the base variant
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border">
                                                {presetVariant.variant.questionText.slice(0, 100)}
                                                {presetVariant.variant.questionText.length > 100 ? '...' : ''}
                                            </div>
                                            <Button
                                                type="button"
                                                onClick={() => handleCopyFromVariant(presetVariant)}
                                                className="w-full"
                                                size="sm"
                                                variant="outline"
                                            >
                                                Copy Fields
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Option 2: Generate with EduAI */}
                                <div className="rounded-lg border-2 border-muted bg-card p-4 space-y-3" data-tour-id="aq-eduai-panel">
                                    <div className="space-y-2">
                                        <div className="flex items-start gap-2">
                                            <div className="flex-1">
                                                <h5 className="text-sm font-semibold">Generate with EduAI</h5>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {mode === 'variant'
                                                        ? 'Let EduAI create a variant based on a prompt'
                                                        : 'Let EduAI generate a question from a prompt'}
                                                </p>
                                            </div>
                                        </div>
                                        <EduAIStatusBadge
                                            status={eduaiStatus.status}
                                            message={eduaiStatus.message}
                                            onRefresh={eduaiStatus.refresh}
                                            className="z-50"
                                        />
                                    </div>

                                    {courseWarningMessage && (
                                        <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                                            {courseWarningMessage}
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <div className="space-y-1.5" data-tour-id="aq-ai-prompt">
                                            <Label htmlFor="ai-prompt" className="text-xs font-medium">Prompt</Label>
                                            <Textarea
                                                id="ai-prompt"
                                                value={form.generationPrompt}
                                                onChange={(event) => handleFieldChange('generationPrompt', event.target.value)}
                                                placeholder={mode === 'variant'
                                                    ? 'e.g., Make it harder and focus on edge cases'
                                                    : 'e.g., Time complexity of quicksort'}
                                                className="text-xs resize-none"
                                                rows={form.generationPrompt.length > 50 ? 4 : 2}
                                                onFocus={(e) => {
                                                    if (e.target.rows === 2) {
                                                        e.target.rows = 4;
                                                    }
                                                }}
                                                onBlur={(e) => {
                                                    if (form.generationPrompt.length <= 50) {
                                                        e.target.rows = 2;
                                                    }
                                                }}
                                            />
                                        </div>

                                        <div className="space-y-1.5" data-tour-id="aq-model-picker">
                                            <Label htmlFor="ai-model" className="text-xs font-medium">Model</Label>
                                            <Select
                                                value={form.generationModel}
                                                onValueChange={(value) => handleFieldChange('generationModel', value)}
                                                disabled={availableModels.length === 0}
                                            >
                                                <SelectTrigger id="ai-model" className="h-9 text-xs">
                                                    <SelectValue placeholder="Select model" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableModels.length === 0 ? (
                                                        <SelectItem value="__no_models" disabled className="text-xs">
                                                            No models available
                                                        </SelectItem>
                                                    ) : (
                                                        <>
                                                            {availableModels.some((model) => model.provider === 'ollama') && (
                                                                <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">
                                                                    UBC Hosted
                                                                </div>
                                                            )}
                                                            {availableModels
                                                                .filter((model) => model.provider === 'ollama')
                                                                .map((model) => (
                                                                    <SelectItem key={model.id} value={model.id} className="text-xs">
                                                                        {model.label}
                                                                    </SelectItem>
                                                                ))}
                                                            {availableModels.some((model) => model.provider !== 'ollama') && (
                                                                <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">
                                                                    External
                                                                </div>
                                                            )}
                                                            {availableModels
                                                                .filter((model) => model.provider !== 'ollama')
                                                                .map((model) => (
                                                                    <SelectItem key={model.id} value={model.id} className="text-xs">
                                                                        {model.label} {model.provider ? `(${model.provider})` : ''}
                                                                    </SelectItem>
                                                                ))}
                                                        </>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {isExternalGenerationModel && (
                                            <div className="w-full rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                                <span className="font-semibold">Warning:</span> External models send your prompts and course data to that provider. UBC-hosted models keep data within UBC systems.
                                            </div>
                                        )}

                                        {apiKeyStorage.requiresApiKey(form.generationModel) && (
                                            <div className="space-y-1.5">
                                                <Label htmlFor="provider-api-key" className="text-xs font-medium">
                                                    {apiKeyStorage.getProviderFromModel(form.generationModel)?.toUpperCase()} API Key
                                                </Label>
                                                {providerApiKey ? (
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            id="provider-api-key"
                                                            type="text"
                                                            value={`${providerApiKey.substring(0, 8)}${'•'.repeat(Math.max(0, providerApiKey.length - 8))}`}
                                                            disabled
                                                            className="h-9 text-xs flex-1"
                                                        />
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                const provider = apiKeyStorage.getProviderFromModel(form.generationModel);
                                                                if (provider) {
                                                                    apiKeyStorage.removeApiKey(provider);
                                                                    setProviderApiKey('');
                                                                }
                                                            }}
                                                        >
                                                            Change
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Input
                                                        id="provider-api-key"
                                                        type="password"
                                                        placeholder={`Enter your ${apiKeyStorage.getProviderFromModel(form.generationModel)?.toUpperCase()} API key`}
                                                        value={providerApiKey}
                                                        className="h-9 text-xs"
                                                        onChange={(event) => {
                                                            const value = event.target.value;
                                                            setProviderApiKey(value);
                                                            const provider = apiKeyStorage.getProviderFromModel(form.generationModel);
                                                            if (provider && value) {
                                                                void apiKeyStorage.setApiKey(provider, value);
                                                            }
                                                        }}
                                                    />
                                                )}
                                                <p className="text-[11px] text-muted-foreground">
                                                    Your API key is stored locally in your browser and never sent to our servers.
                                                </p>
                                            </div>
                                        )}

                                        <div className="space-y-1.5">
                                            <Label htmlFor="ai-difficulty" className="text-xs font-medium">Difficulty</Label>
                                            <Select
                                                value={form.generationDifficulty}
                                                onValueChange={(value) =>
                                                    handleFieldChange('generationDifficulty', value as QuestionDifficulty | 'balanced')
                                                }
                                            >
                                                <SelectTrigger id="ai-difficulty" className="h-9 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="balanced" className="text-xs">Let EduAI decide</SelectItem>
                                                    <SelectItem value="easy" className="text-xs">Easy</SelectItem>
                                                    <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                                                    <SelectItem value="hard" className="text-xs">Hard</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="ai-reasoning-level" className="text-xs font-medium">Reasoning Focus</Label>
                                            <Select
                                                value={form.generationReasoningLevel}
                                                onValueChange={(value) =>
                                                    handleFieldChange('generationReasoningLevel', value as ReasoningLevel | 'balanced')
                                                }
                                            >
                                                <SelectTrigger id="ai-reasoning-level" className="h-9 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="balanced" className="text-xs">Let EduAI decide</SelectItem>
                                                    <SelectItem value="factual" className="text-xs">Factual</SelectItem>
                                                    <SelectItem value="analytical" className="text-xs">Analytical</SelectItem>
                                                    <SelectItem value="application" className="text-xs">Application</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <Button
                                            type="button"
                                            onClick={handleGenerateWithAI}
                                            disabled={isGenerating}
                                            className="w-full"
                                            size="sm"
                                            data-tour-id="aq-ai-generate"
                                        >
                                            {isGenerating ? 'Generating...' : 'Generate'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                <DialogFooter className="pt-4 flex-col sm:flex-row gap-3">
                    <div className="flex items-center space-x-2" data-tour-id="aq-draft-toggle">
                        <input
                            type="checkbox"
                            id="mark-as-reviewed"
                            checked={markAsReviewed}
                            onChange={(e) => setMarkAsReviewed(e.target.checked)}
                            disabled={isSubmitting}
                            className="h-4 w-4 rounded border-gray-300"
                        />
                        <label
                            htmlFor="mark-as-reviewed"
                            className="text-sm text-foreground cursor-pointer"
                        >
                            Mark as reviewed
                        </label>
                    </div>
                    <div className="flex gap-2 ml-auto">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={
                                isSubmitting ||
                                (mode === 'variant' && !form.baseSelection)
                            }
                            data-tour-id="aq-save"
                        >
                            {isSubmitting
                                ? 'Saving...'
                                : mode === 'new'
                                    ? markAsReviewed
                                        ? 'Create Question'
                                        : 'Create Question (Draft)'
                                    : 'Add Variant'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
            
            {/* Error Details Modal */}
            <Dialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>AI Generation Error Details</DialogTitle>
                        <DialogDescription>
                            The AI was unable to generate the question. Here's the detailed explanation:
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="rounded-lg border bg-destructive/10 p-4">
                            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                                {errorModalMessage}
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setErrorModalOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
};
