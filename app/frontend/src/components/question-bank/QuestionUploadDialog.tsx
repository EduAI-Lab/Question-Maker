import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useToast } from '../ui/use-toast';

import { ExtractedQuestion, Question, QuestionDifficulty, QuestionType } from '../../types/question';
import { Topic } from '../../types/topic';
import { questionService } from '../../services/questionService';

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

type DraftQuestion = Required<Pick<ExtractedQuestion, 'question'>> &
  Omit<ExtractedQuestion, 'question'> & {
    id: string;
    instructions?: string;
    difficulty: QuestionDifficulty;
    answer?: string | null;
    type: QuestionType;
    summary: string;
    include: boolean;
  };

const difficultyOptions: QuestionDifficulty[] = ['easy', 'medium', 'hard'];
const questionTypes: QuestionType[] = ['SA', 'MCQ'];

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

  const [topics, setTopics] = useState<Topic[]>(providedTopics);
  const [primaryTopicId, setPrimaryTopicId] = useState<string>('');
  const [newTopicName, setNewTopicName] = useState('Uploaded Questions');
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([]);
  const [processingStage, setProcessingStage] = useState<'idle' | 'ocr' | 'extracting' | 'review' | 'saving'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [lastFileName, setLastFileName] = useState<string>('');

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
    setProcessingStage('extracting');
    setProgress(85);
    const response = await questionService.extractQuestionsFromText({ text });
    const drafts = (response || [])
      .filter((item): item is ExtractedQuestion & { summary: string } =>
        Boolean(
          item.question &&
          item.question.trim().length > 0 &&
          item.summary &&
          item.summary.trim().length > 0
        )
      )
      .map((item) => ({
        id: item.id ?? generateId(),
        question: item.question.trim(),
        instructions: item.instructions?.trim() ?? '',
        difficulty: item.difficulty && ['easy', 'medium', 'hard'].includes(item.difficulty)
          ? (item.difficulty as QuestionDifficulty)
          : 'medium',
        answer: item.answer ?? '',
        type: item.type && ['MCQ', 'SA'].includes(item.type) ? (item.type as QuestionType) : 'SA',
        summary: item.summary.trim(),
        include: item.include !== false
      }));

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
  }, [toast]);

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

  const includedDrafts = useMemo(
    () => draftQuestions.filter((draft) => draft.include && draft.question.trim().length > 0),
    [draftQuestions]
  );

  const canSave = useMemo(() => {
    if (processingStage === 'saving') return false;
    if (!courseId) return false;
    if (includedDrafts.length === 0) return false;
    return true;
  }, [courseId, includedDrafts.length, processingStage]);

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
      summary: draft.summary.trim()
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

    setProcessingStage('saving');
    setProgress(100);
    setError(null);

    try {
      const saved = await questionService.saveExtractedQuestions({
        courseId,
        primaryTopicId: primaryTopicId ? Number(primaryTopicId) : undefined,
        topicName: primaryTopicId ? undefined : (newTopicName.trim() || 'Uploaded Questions'),
        questions: payloadQuestions
      });

      onQuestionsSaved(saved);
      toast({
        title: 'Questions added',
        description: `${saved.length} question${saved.length === 1 ? '' : 's'} saved successfully.`
      });
      onClose();
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
  }, [canSave, courseId, includedDrafts, newTopicName, onClose, onQuestionsSaved, primaryTopicId, toast]);

  const handleReset = useCallback(() => {
    setDraftQuestions([]);
    setProcessingStage('idle');
    setProgress(0);
    setError(null);
    setLastFileName('');
    setPrimaryTopicId(topics.length > 0 ? String(topics[0].id) : '');
    setNewTopicName(topics.length > 0 ? '' : 'Uploaded Questions');
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

  const primaryTopicName = topics.find((topic) => String(topic.id) === primaryTopicId)?.name ?? topics[0]?.name;

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upload Questions</DialogTitle>
          <DialogDescription>
            Upload a PDF or image containing questions for{' '}
            <span className="font-medium text-foreground">{courseName ?? 'the selected course'}</span>.
            {' '}
            We&apos;ll extract them with OCR and AI so you can review before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-base font-semibold">Upload a file</CardTitle>
              <p className="text-xs text-muted-foreground">
                Questions will be saved to <span className="font-medium text-foreground">{courseName ?? 'the selected course'}</span>.
                {' '}
                {topics.length > 0
                  ? `Primary topic: ${primaryTopicName ?? '—'}.`
                  : 'A new topic will be created automatically for these questions.'}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <label
                htmlFor="question-upload"
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
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Review extracted questions ({draftQuestions.length})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyAll}>
                    <CopyIcon className="mr-2 h-4 w-4" />
                    Copy all
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    Clear
                  </Button>
                </div>
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
                        <div className="space-y-2">
                          <Label>Instructions (optional)</Label>
                          <Textarea
                            rows={2}
                            value={draft.instructions ?? ''}
                            onChange={(event) => updateDraft(draft.id, { instructions: event.target.value })}
                          />
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
                                    {type === 'MCQ' ? 'Multiple Choice' : 'Short Answer'}
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
            <Button onClick={() => void handleSave()} disabled={!canSave}>
              {processingStage === 'saving' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Questions
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
