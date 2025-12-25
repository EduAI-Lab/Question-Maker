/**
 * Dialog for uploading PDF/image files, running OCR, and extracting questions via EduAI.
 * Manages draft review, topic selection, optional assessment creation, and save flows.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Tesseract from 'tesseract.js';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker?url';
import { UploadCloud, FileText, Loader2, Trash2, Copy as CopyIcon, RefreshCcw } from 'lucide-react';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { Progress } from '../ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tooltip } from '../ui/tooltip';
import { useToast } from '../ui/use-toast';
import { useEduAIStatus } from '../../hooks/useEduAIStatus';
import { EduAIStatusBadge } from '../eduai/EduAIStatusBadge';

import { ExtractedQuestion, Question, QuestionDifficulty, QuestionType } from '../../types/question';
import { Topic } from '../../types/topic';
import { questionService } from '../../services/questionService';
import { eduaiService, EduAIModelOption } from '../../services/eduaiService';
import { apiKeyStorage } from '../../services/apiKeyStorage';

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

type DraftQuestion = Required<Pick<ExtractedQuestion, 'question'>> &
    Omit<ExtractedQuestion, 'question'> & {
        id: string;
        instructions?: string;
        difficulty: QuestionDifficulty;
        answer?: string | null;
        type: QuestionType;
        summary: string;
        primaryTopicId: number | null;
        secondaryTopicIds: number[];
        include: boolean;
    };

const difficultyOptions: QuestionDifficulty[] = ['easy', 'medium', 'hard'];
const questionTypes: QuestionType[] = ['SA', 'MCQ', 'LA'];
const questionTypeLabels: Record<QuestionType, string> = {
    MCQ: 'Multiple Choice',
    SA: 'Short Answer',
    LA: 'Long Answer'
};
const assessmentTypes = ['Assignment', 'Lab', 'Quiz', 'Midterm', 'Final'] as const;

interface QuestionUploadDialogProps {
    open: boolean;
    onClose: () => void;
    courseId: number | null;
    courseName?: string;
    topics: Topic[];
    onEnsureTopics: (courseId: number) => Promise<Topic[]>;
    onQuestionsSaved: (questions: Question[]) => void;
}

const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2, 11);
};

const isPdfFile = (file: File) =>
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

const isImageFile = (file: File) =>
    file.type.startsWith('image/') ||
    /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(file.name);

export const QuestionUploadDialog = ({
    open,
    onClose,
    courseId,
    courseName,
    topics: providedTopics,
    onEnsureTopics,
    onQuestionsSaved
}: QuestionUploadDialogProps) => {
    const { toast } = useToast();
    const navigate = useNavigate();

    const [topics, setTopics] = useState<Topic[]>(providedTopics);
    const [primaryTopicId, setPrimaryTopicId] = useState<string>('');
    const [newTopicName, setNewTopicName] = useState('Uploaded Questions');
    const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([]);
    const [processingStage, setProcessingStage] = useState<'idle' | 'ocr' | 'extracting' | 'review' | 'saving'>('idle');
    const [progress, setProgress] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const [lastFileName, setLastFileName] = useState<string>('');
    const [assessmentType, setAssessmentType] = useState<typeof assessmentTypes[number]>('Assignment');
    const [assessmentName, setAssessmentName] = useState('Uploaded Assessment');
    const [assessmentSemester, setAssessmentSemester] = useState(() => {
        const now = new Date();
        const year = now.getFullYear();
        return `Fall ${year}`;
    });
    const [availableModels, setAvailableModels] = useState<EduAIModelOption[]>([]);
    const [aiModel, setAiModel] = useState('ollama:gpt-oss:120b');
    const [providerApiKey, setProviderApiKey] = useState('');
    const eduaiStatus = useEduAIStatus();
    const selectedModel = useMemo(
        () => availableModels.find((model) => model.id === aiModel),
        [aiModel, availableModels]
    );
    const isExternalModel = useMemo(
        () => (selectedModel ? selectedModel.provider !== 'ollama' : !aiModel.startsWith('ollama')),
        [aiModel, selectedModel]
    );

    useEffect(() => {
        if (!open) {
            return;
        }

        setTopics(providedTopics);
        if (providedTopics.length > 0) {
            setPrimaryTopicId(String(providedTopics[0].id));
            setNewTopicName('');
        } else {
            setPrimaryTopicId('');
            setNewTopicName('Uploaded Questions');
        }
        setDraftQuestions([]);
        setProcessingStage('idle');
        setProgress(0);
        setError(null);
        setLastFileName('');
        setAssessmentType('Assignment');
        setAssessmentName('Assignment 1');
        setAssessmentSemester(() => {
            const now = new Date();
            const year = now.getFullYear();
            return `Fall ${year}`;
        });
    }, [open, providedTopics]);

    useEffect(() => {
        if (!open || !courseId) return;
        if (providedTopics.length > 0) return;

        const ensureTopics = async () => {
            try {
                const refreshed = await onEnsureTopics(courseId);
                setTopics(refreshed);
                if (refreshed.length > 0) {
                    setPrimaryTopicId(String(refreshed[0].id));
                    setNewTopicName('');
                } else {
                    setPrimaryTopicId('');
                    setNewTopicName('Uploaded Questions');
                }
            } catch (err) {
                console.error('Failed to refresh topics', err);
                setTopics([]);
                setPrimaryTopicId('');
                setNewTopicName('Uploaded Questions');
            }
        };

        void ensureTopics();
    }, [open, courseId, providedTopics.length, onEnsureTopics]);

    useEffect(() => {
        if (!open) return;
        if (topics.length > 0) {
            setPrimaryTopicId((prev) => (prev ? prev : String(topics[0].id)));
            setNewTopicName('');
        } else {
            setPrimaryTopicId('');
            setNewTopicName('Uploaded Questions');
        }
    }, [open, topics]);

    // No auto-start; keep a single tour entry point.

    useEffect(() => {
        if (!open) return;

        const fetchModels = async () => {
            try {
                const models = await eduaiService.listModels();
                setAvailableModels(models);
            } catch (error) {
                console.error('Failed to fetch AI models:', error);
                setAvailableModels([]);
            }
        };

        void fetchModels();
    }, [open]);

    // Load API key when model changes
    useEffect(() => {
        if (!aiModel) return;

        const loadApiKey = async () => {
            const provider = apiKeyStorage.getProviderFromModel(aiModel);
            if (provider) {
                const savedKey = await apiKeyStorage.getApiKey(provider);
                setProviderApiKey(savedKey || '');
            } else {
                setProviderApiKey('');
            }
        };

        void loadApiKey();
    }, [aiModel]);

    const performPdfOcr = useCallback(async (file: File, onProgress: (value: number) => void) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await getDocument({ data: arrayBuffer }).promise;
        let combinedText = '';

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            const pageText = content.items
                .map((item: any) => ('str' in item ? item.str : ''))
                .join(' ');
            combinedText += `${pageText}\n`;
            onProgress(Math.round((pageNumber / pdf.numPages) * 70));
        }

        return combinedText;
    }, []);

    const performImageOcr = useCallback(async (file: File, onProgress: (value: number) => void) => {
        const result = await Tesseract.recognize(file, 'eng', {
            logger: (message) => {
                if (message.status === 'recognizing text') {
                    onProgress(10 + Math.round(message.progress * 60));
                }
            }
        });
        return result.data.text;
    }, []);

    const performOcr = useCallback(async (file: File) => {
        setProcessingStage('ocr');
        setProgress(5);

        let text = '';
        if (isPdfFile(file)) {
            text = await performPdfOcr(file, setProgress);
        } else if (isImageFile(file)) {
            text = await performImageOcr(file, setProgress);
        } else {
            throw new Error('Unsupported file type. Please upload a PDF or image file.');
        }

        if (!text.trim()) {
            throw new Error('No text detected in the uploaded file.');
        }

        return text;
    }, [performImageOcr, performPdfOcr]);

    const handleExtractQuestions = useCallback(async (text: string) => {
        if (!courseId) {
            throw new Error('Select a course before extracting questions.');
        }

        setProcessingStage('extracting');
        setProgress(85);
        console.log('QuestionUploadDialog: Extracting questions with model:', aiModel);

        const apiKeys = await apiKeyStorage.buildApiKeysForModel(aiModel);
        const response = await questionService.extractQuestionsFromText({
            text,
            courseId,
            model: aiModel,
            apiKeys
        });
        const drafts = (response || [])
            .filter((item): item is ExtractedQuestion & { summary: string } =>
                Boolean(
                    item.question &&
                    item.question.trim().length > 0 &&
                    item.summary &&
                    item.summary.trim().length > 0
                )
            )
            .map((item) => {
                const primaryCandidate = item.primaryTopicId !== undefined && item.primaryTopicId !== null
                    ? Number(item.primaryTopicId)
                    : null;
                const primaryTopicId = Number.isInteger(primaryCandidate) ? primaryCandidate : null;

                const secondaryTopicIds = Array.isArray(item.secondaryTopicIds)
                    ? Array.from(
                        new Set(
                            item.secondaryTopicIds
                                .map((value) => Number(value))
                                .filter((value) => Number.isInteger(value) && value !== primaryTopicId)
                        )
                    )
                    : [];

                return {
                    id: item.id ?? generateId(),
                    question: item.question.trim(),
                    instructions: item.instructions?.trim() ?? '',
                    difficulty: item.difficulty && ['easy', 'medium', 'hard'].includes(item.difficulty)
                        ? (item.difficulty as QuestionDifficulty)
                        : 'medium',
                    answer: item.answer ?? '',
                    type: item.type && ['MCQ', 'SA', 'LA'].includes(item.type) ? (item.type as QuestionType) : 'SA',
                    summary: item.summary.trim(),
                    primaryTopicId,
                    secondaryTopicIds,
                    include: item.include !== false
                };
            });

        if (drafts.length === 0) {
            throw new Error('No questions could be extracted from the provided text.');
        }

        setDraftQuestions(drafts);
        setProcessingStage('review');
        setProgress(100);

        toast({
            title: 'Questions extracted',
            description: `Parsed ${drafts.length} question${drafts.length === 1 ? '' : 's'} from the upload.`
        });
    }, [courseId, toast, aiModel]);

    const processFile = useCallback(async (file: File) => {
        setError(null);
        setDraftQuestions([]);
        setLastFileName(file.name);
        try {
            const text = await performOcr(file);
            await handleExtractQuestions(text);
        } catch (err: any) {
            console.error('Question extraction failed', err);
            const message = err?.response?.data?.error || err?.message || 'Failed to extract questions.';
            setError(message);
            setProcessingStage('idle');
            setProgress(0);
            toast({
                variant: 'destructive',
                title: 'Question extraction failed',
                description: message
            });
        }
    }, [handleExtractQuestions, performOcr, toast]);

    const handleFileChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (file) {
                void processFile(file);
            }
        },
        [processFile]
    );

    const updateDraft = useCallback((id: string, updates: Partial<DraftQuestion>) => {
        setDraftQuestions((prev) =>
            prev.map((draft) => (draft.id === id ? { ...draft, ...updates } : draft))
        );
    }, []);

    const removeDraft = useCallback((id: string) => {
        setDraftQuestions((prev) => prev.filter((draft) => draft.id !== id));
    }, []);

    const setPrimaryTopicForDraft = useCallback((id: string, topicId: number | null) => {
        const normalizedTopicId = typeof topicId === 'number' && Number.isInteger(topicId) ? topicId : null;
        setDraftQuestions((prev) =>
            prev.map((draft) => {
                if (draft.id !== id) {
                    return draft;
                }
                const cleanedSecondary = normalizedTopicId === null
                    ? draft.secondaryTopicIds
                    : draft.secondaryTopicIds.filter((value) => value !== normalizedTopicId);
                return {
                    ...draft,
                    primaryTopicId: normalizedTopicId,
                    secondaryTopicIds: cleanedSecondary
                };
            })
        );
    }, []);

    const toggleSecondaryTopicForDraft = useCallback((id: string, topicId: number) => {
        setDraftQuestions((prev) =>
            prev.map((draft) => {
                if (draft.id !== id) {
                    return draft;
                }

                if (draft.primaryTopicId === topicId) {
                    return draft;
                }

                const exists = draft.secondaryTopicIds.includes(topicId);
                const nextSecondary = exists
                    ? draft.secondaryTopicIds.filter((value) => value !== topicId)
                    : [...draft.secondaryTopicIds, topicId];

                return {
                    ...draft,
                    secondaryTopicIds: nextSecondary
                };
            })
        );
    }, []);

    const includedDrafts = useMemo(
        () => draftQuestions.filter((draft) => draft.include && draft.question.trim().length > 0),
        [draftQuestions]
    );

    const canSave = useMemo(() => {
        if (processingStage === 'saving') return false;
        if (!courseId) return false;
        if (includedDrafts.length === 0) return false;
        if (!assessmentType || !assessmentName.trim() || !assessmentSemester.trim()) return false;
        return true;
    }, [assessmentName, assessmentSemester, assessmentType, courseId, includedDrafts.length, processingStage]);

    const getDisabledReason = (): string | null => {
        if (processingStage === 'saving') return null; // Don't show tooltip while saving
        if (!canSave) {
            const reasons: string[] = [];
            if (!courseId) reasons.push('course');
            if (includedDrafts.length === 0) reasons.push('at least one question selected');
            if (!assessmentType) reasons.push('assessment type');
            if (!assessmentName.trim()) reasons.push('assessment name');
            if (!assessmentSemester.trim()) reasons.push('assessment semester');
            
            if (reasons.length > 0) {
                return `Missing required: ${reasons.join(', ')}`;
            }
        }
        return null;
    };

    const disabledReason = getDisabledReason();

    const handleCopyAll = useCallback(async () => {
        const lines = draftQuestions.map((draft, index) => {
            const base = [`${index + 1}. ${draft.question.trim()}`];
            if (draft.summary?.trim()) {
                base.splice(1, 0, `Summary: ${draft.summary.trim()}`);
            }
            if (draft.instructions?.trim()) {
                base.push(`Instructions: ${draft.instructions.trim()}`);
            }
            if (draft.answer?.trim()) {
                base.push(`Answer: ${draft.answer.trim()}`);
            }
            base.push(`Difficulty: ${draft.difficulty}`);
            return base.join('\n');
        });

        try {
            await navigator.clipboard.writeText(lines.join('\n\n'));
            toast({
                title: 'Copied',
                description: 'Extracted questions copied to clipboard.'
            });
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Copy failed',
                description: 'Could not copy questions to clipboard.'
            });
        }
    }, [draftQuestions, toast]);

    const handleSave = useCallback(async () => {
        if (!canSave || !courseId) return;

        const payloadQuestions = includedDrafts.map((draft) => ({
            question: draft.question.trim(),
            instructions: draft.instructions?.trim(),
            difficulty: draft.difficulty,
            answer: draft.answer?.trim() || null,
            type: draft.type,
            summary: draft.summary.trim(),
            primaryTopicId: draft.primaryTopicId ?? undefined,
            secondaryTopicIds: draft.secondaryTopicIds
        }));

        if (payloadQuestions.length === 0) {
            setError('Select at least one question to create.');
            return;
        }

        const missingSummary = payloadQuestions.find((item) => !item.summary);
        if (missingSummary) {
            setError('Each question must include the AI-generated summary before saving.');
            return;
        }
        if (!assessmentType || !assessmentName.trim() || !assessmentSemester.trim()) {
            setError('Assessment type, name, and semester are required.');
            return;
        }
        setProcessingStage('saving');
        setProgress(100);
        setError(null);

        try {
            const fallbackPrimaryTopicId =
                topics.length > 0 && primaryTopicId ? Number(primaryTopicId) : undefined;
            const fallbackTopicName =
                topics.length === 0 ? (newTopicName.trim() || 'Uploaded Questions') : undefined;

            const result = await questionService.saveExtractedQuestions({
                courseId,
                primaryTopicId: fallbackPrimaryTopicId,
                topicName: fallbackTopicName,
                questions: payloadQuestions,
                assessment: {
                    type: assessmentType,
                    name: assessmentName.trim(),
                    semester: assessmentSemester.trim()
                }
            });

            onQuestionsSaved(result.questions);
            toast({
                title: 'Questions added',
                description: `${result.questions.length} question${result.questions.length === 1 ? '' : 's'} saved successfully.`
            });
            onClose();

            // Navigate to the newly created assessment
            if (result.assessmentId) {
                navigate(`/assessments/${result.assessmentId}`);
            }
        } catch (err: any) {
            console.error('Failed to save extracted questions', err);
            const message = err?.response?.data?.error || err?.message || 'Failed to save questions.';
            setError(message);
            toast({
                variant: 'destructive',
                title: 'Save failed',
                description: message
            });
            setProcessingStage('review');
        }
    }, [assessmentName, assessmentSemester, assessmentType, canSave, courseId, includedDrafts, newTopicName, onClose, onQuestionsSaved, primaryTopicId, toast, topics.length]);

    const handleReset = useCallback(() => {
        setDraftQuestions([]);
        setProcessingStage('idle');
        setProgress(0);
        setError(null);
        setLastFileName('');
        setPrimaryTopicId(topics.length > 0 ? String(topics[0].id) : '');
        setNewTopicName(topics.length > 0 ? '' : 'Uploaded Questions');
        setAssessmentType('Assignment');
        setAssessmentName('Assignment 1');
        setAssessmentSemester(() => {
            const now = new Date();
            const year = now.getFullYear();
            return `Fall ${year}`;
        });
    }, [topics]);

    if (!courseId) {
        return (
            <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>No course selected</DialogTitle>
                        <DialogDescription>Select a course before uploading questions.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={onClose}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
            <DialogContent className="max-w-3xl sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div>
                        <DialogTitle>Upload Questions</DialogTitle>
                        <DialogDescription>
                            Upload a PDF or image containing questions for{' '}
                            <span className="font-medium text-foreground">{courseName ?? 'the selected course'}</span>.
                            {' '}
                            We&apos;ll extract them with OCR and AI so you can review before saving.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="space-y-6 py-2">
                    <Card data-tour-id="upload-assessment-meta">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-base font-semibold">Assessment details</CardTitle>
                            <p className="text-xs text-muted-foreground">
                                A new assessment will be created for these questions.
                            </p>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="assessment-type">Type</Label>
                                <Select
                                    value={assessmentType}
                                    onValueChange={(value) => setAssessmentType(value as typeof assessmentTypes[number])}
                                >
                                    <SelectTrigger id="assessment-type">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {assessmentTypes.map((type) => (
                                            <SelectItem key={type} value={type}>
                                                {type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="assessment-name">Name</Label>
                                <Input
                                    id="assessment-name"
                                    placeholder="e.g. Midterm Review Set"
                                    value={assessmentName}
                                    onChange={(event) => setAssessmentName(event.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="assessment-semester">Semester</Label>
                                <Input
                                    id="assessment-semester"
                                    placeholder="e.g. Fall 2024"
                                    value={assessmentSemester}
                                    onChange={(event) => setAssessmentSemester(event.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="space-y-1">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-semibold">Upload a file</CardTitle>
                                <EduAIStatusBadge
                                    status={eduaiStatus.status}
                                    message={eduaiStatus.message}
                                    onRefresh={eduaiStatus.refresh}
                                    className="z-50"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Questions will be saved to <span className="font-medium text-foreground">{courseName ?? 'the selected course'}</span>.
                                {' '}Topics are assigned automatically after extraction—you can adjust them in the review step.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2" data-tour-id="upload-model">
                                <Label htmlFor="ai-model">AI model</Label>
                                <Select value={aiModel} onValueChange={setAiModel}>
                                    <SelectTrigger id="ai-model">
                                        <SelectValue placeholder="Select a model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableModels.length === 0 ? (
                                            <SelectItem value="__no_models" disabled>
                                                No models available yet
                                            </SelectItem>
                                        ) : (
                                            <>
                                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">UBC Hosted</div>
                                                {availableModels
                                                    .filter((option) => option.provider === 'ollama')
                                                    .map((option) => (
                                                        <SelectItem key={option.id} value={option.id}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">External</div>
                                                {availableModels
                                                    .filter((option) => option.provider !== 'ollama')
                                                    .map((option) => (
                                                        <SelectItem key={option.id} value={option.id}>
                                                            {option.label} ({option.provider})
                                                        </SelectItem>
                                                    ))}
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                                {isExternalModel && (
                                    <div className="w-full rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                        <span className="font-semibold">Warning:</span> External models send your prompts and course data to that provider. UBC-hosted models keep data within UBC systems.
                                    </div>
                                )}
                            </div>

                            {apiKeyStorage.requiresApiKey(aiModel) && (
                                <div className="space-y-2">
                                    <Label htmlFor="provider-api-key">
                                        {apiKeyStorage.getProviderFromModel(aiModel)?.toUpperCase()} API Key
                                    </Label>
                                    {providerApiKey ? (
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id="provider-api-key"
                                                type="text"
                                                value={`${providerApiKey.substring(0, 8)}${'•'.repeat(Math.max(0, providerApiKey.length - 8))}`}
                                                disabled
                                                className="flex-1"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    const provider = apiKeyStorage.getProviderFromModel(aiModel);
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
                                            placeholder={`Enter your ${apiKeyStorage.getProviderFromModel(aiModel)?.toUpperCase()} API key`}
                                            value={providerApiKey}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setProviderApiKey(value);
                                                const provider = apiKeyStorage.getProviderFromModel(aiModel);
                                                if (provider && value) {
                                                    void apiKeyStorage.setApiKey(provider, value);
                                                }
                                            }}
                                        />
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        Your API key is stored locally in your browser and never sent to our servers.
                                    </p>
                                </div>
                            )}

                            {(!lastFileName && draftQuestions.length === 0) && (
                                <label
                                    htmlFor="question-upload"
                                    data-tour-id="upload-file"
                                    className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-6 text-center transition hover:border-primary hover:bg-muted/50 cursor-pointer"
                                >
                                    <UploadCloud className="h-10 w-10 text-muted-foreground" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium">Drop PDF or image file here</p>
                                        <p className="text-xs text-muted-foreground">We support PDF, PNG, JPG and other common formats.</p>
                                    </div>
                                    <input
                                        id="question-upload"
                                        type="file"
                                        accept=".pdf,image/*"
                                        className="hidden"
                                        onChange={handleFileChange}
                                        disabled={processingStage === 'ocr' || processingStage === 'extracting' || processingStage === 'saving'}
                                    />
                                </label>
                            )}
                            {lastFileName && (
                                <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <span className="truncate">{lastFileName}</span>
                                    <Button variant="ghost" size="icon" className="ml-auto" onClick={handleReset}>
                                        <RefreshCcw className="h-4 w-4" />
                                        <span className="sr-only">Reset</span>
                                    </Button>
                                </div>
                            )}
                            {(processingStage === 'ocr' || processingStage === 'extracting' || processingStage === 'saving') && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>
                                            {processingStage === 'ocr' && 'Running OCR...'}
                                            {processingStage === 'extracting' && 'Extracting questions with AI...'}
                                            {processingStage === 'saving' && 'Saving questions to the database...'}
                                        </span>
                                    </div>
                                    <Progress value={progress} />
                                </div>
                            )}
                            {error && (
                                <p className="text-sm text-red-600">
                                    {error}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {draftQuestions.length > 0 && (
                        <Card data-tour-id="upload-review">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="text-base font-semibold">
                                    Review extracted questions ({draftQuestions.length})
                                </CardTitle>
                                <div className="flex items-center gap-2" />
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="max-h-[320px] rounded-md border">
                                    <div className="divide-y">
                                        {draftQuestions.map((draft, index) => (
                                            <div key={draft.id} className="space-y-4 p-4">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-semibold">Question {index + 1}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            Toggle include to skip saving a specific question.
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant={draft.include ? 'secondary' : 'outline'}
                                                            size="sm"
                                                            onClick={() => updateDraft(draft.id, { include: !draft.include })}
                                                        >
                                                            {draft.include ? 'Included' : 'Excluded'}
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => removeDraft(draft.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                            <span className="sr-only">Remove question</span>
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Question summary</Label>
                                                    <Input
                                                        value={draft.summary}
                                                        placeholder="One sentence describing the question"
                                                        onChange={(event) => updateDraft(draft.id, { summary: event.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Question text</Label>
                                                    <Textarea
                                                        rows={3}
                                                        value={draft.question}
                                                        onChange={(event) => updateDraft(draft.id, { question: event.target.value })}
                                                    />
                                                </div>
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <div className="space-y-2">
                                                        <Label>Primary topic</Label>
                                                        <Select
                                                            value={draft.primaryTopicId !== null ? String(draft.primaryTopicId) : 'none'}
                                                            onValueChange={(value) => {
                                                                if (value === 'none') {
                                                                    setPrimaryTopicForDraft(draft.id, null);
                                                                    return;
                                                                }
                                                                const parsed = Number.parseInt(value, 10);
                                                                setPrimaryTopicForDraft(
                                                                    draft.id,
                                                                    Number.isNaN(parsed) ? null : parsed
                                                                );
                                                            }}
                                                            disabled={topics.length === 0}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder={topics.length === 0 ? 'No topics available' : 'Select topic'} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">Unassigned</SelectItem>
                                                                {topics.map((topic) => (
                                                                    <SelectItem key={topic.id} value={String(topic.id)}>
                                                                        {topic.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Secondary topics</Label>
                                                        {topics.length === 0 ? (
                                                            <p className="text-xs text-muted-foreground">No topics available. A new topic will be created automatically.</p>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-2">
                                                                {topics.map((topic) => (
                                                                    <label key={topic.id} className="flex items-center gap-1 text-xs">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="h-4 w-4"
                                                                            checked={draft.secondaryTopicIds.includes(topic.id)}
                                                                            onChange={() => toggleSecondaryTopicForDraft(draft.id, topic.id)}
                                                                            disabled={draft.primaryTopicId === topic.id}
                                                                        />
                                                                        <span>{topic.name}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="grid gap-4 sm:grid-cols-3">
                                                    <div className="space-y-2">
                                                        <Label>Difficulty</Label>
                                                        <Select
                                                            value={draft.difficulty}
                                                            onValueChange={(value) =>
                                                                updateDraft(draft.id, { difficulty: value as QuestionDifficulty })
                                                            }
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {difficultyOptions.map((difficulty) => (
                                                                    <SelectItem key={difficulty} value={difficulty}>
                                                                        {difficulty}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Type</Label>
                                                        <Select
                                                            value={draft.type}
                                                            onValueChange={(value) =>
                                                                updateDraft(draft.id, { type: value as QuestionType })
                                                            }
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {questionTypes.map((type) => (
                                                                    <SelectItem key={type} value={type}>
                                                                        {questionTypeLabels[type]}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Answer (optional)</Label>
                                                        <Textarea
                                                            rows={2}
                                                            value={draft.answer ?? ''}
                                                            onChange={(event) => updateDraft(draft.id, { answer: event.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                <p className="pt-3 text-xs text-muted-foreground">
                                    The AI extraction is a starting point—adjust the question text, instructions, difficulty, or answers before saving.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <DialogFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="text-sm text-muted-foreground">
                        {includedDrafts.length} question{includedDrafts.length === 1 ? '' : 's'} ready to save.
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        {disabledReason ? (
                            <Tooltip content={disabledReason} multiline>
                                <span className="inline-block">
                                    <Button onClick={() => void handleSave()} disabled={!canSave} data-tour-id="upload-create">
                                        {processingStage === 'saving' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Create Questions
                                    </Button>
                                </span>
                            </Tooltip>
                        ) : (
                            <Button onClick={() => void handleSave()} disabled={!canSave} data-tour-id="upload-create">
                                {processingStage === 'saving' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Questions
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
