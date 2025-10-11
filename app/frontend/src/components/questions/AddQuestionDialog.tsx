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
import { assessmentService, AssessmentSummary } from '../../services/assessmentService';
import { Topic } from '../../types/topic';

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
  questionOrder: ''
};

const difficultyOptions: QuestionDifficulty[] = ['easy', 'medium', 'hard'];
const questionTypes: QuestionType[] = ['MCQ', 'SA'];

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
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [isAuxLoading, setIsAuxLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(defaultForm);
      setError(null);
      setTopics([]);
      setAssessments([]);
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
        variantAssessmentId: presetVariant.variant.assessmentId ? presetVariant.variant.assessmentId.toString() : 'none'
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
          assessmentService.getAssessments()
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
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const parseNumber = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const toggleSecondaryTopic = (topicId: number, checked: boolean) => {
    setForm((prev) => {
      const set = new Set(prev.variantSecondaryTopics);
      if (checked) {
        set.add(topicId);
      } else {
        set.delete(topicId);
      }
      return { ...prev, variantSecondaryTopics: Array.from(set) };
    });
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

      if (!form.questionDescription.trim()) {
        throw new Error('Question description is required.');
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
        description: form.questionDescription.trim(),
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
      <DialogContent className="max-h-[90vh] overflow-hidden">
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
                          {type}
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
                      ))
                    }
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
                        return (
                          <label key={topic.id} className="flex items-center space-x-2 text-sm text-foreground">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={checked}
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
