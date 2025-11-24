import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Layers3, Plus, ChevronDown, Trash2, Upload } from 'lucide-react';
import assessmentService from '../services/assessmentService';
import { courseService } from '../services/courseService';
import { questionService } from '../services/questionService';
import { CanvasExportDialog } from '../components/canvas/CanvasExportDialog';
import {
  Assessment,
  AssessmentSection,
  AssessmentBlueprintConfig,
  AssessmentSectionCreateInput,
  SectionVariantLink,
  QuestionType,
  ReasoningDataState,
  Question,
  QuestionVariantEntry
} from '../types/question';
import { Topic } from '../types/topic';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/use-toast';
import { AddQuestionDialog } from '../components/questions/AddQuestionDialog';

const QUESTION_TYPES: QuestionType[] = ['MCQ', 'SA'];

const defaultReasoningData = (): ReasoningDataState => ({
  factual: { total: 40, easyBoundary: 60, hardBoundary: 90 },
  analytical: { total: 35, easyBoundary: 50, hardBoundary: 80 },
  application: { total: 25, easyBoundary: 40, hardBoundary: 70 }
});

const sanitizeTopicGroups = (
  primaryInput: number[],
  secondaryInput: number[],
  excludedInput: number[]
): { primary: number[]; secondary: number[]; excluded: number[] } => {
  const seen = new Set<number>();
  const sanitizeList = (values: number[]) => {
    const result: number[] = [];
    values.forEach((id) => {
      if (!seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    });
    return result;
  };

  return {
    primary: sanitizeList(primaryInput),
    secondary: sanitizeList(secondaryInput),
    excluded: sanitizeList(excludedInput)
  };
};

type QuestionSearchFilters = {
  questionTypes: QuestionType[];
  primaryTopicIds: number[];
  secondaryTopicIds: number[];
  excludedTopicIds: number[];
  difficulty?: 'easy' | 'medium' | 'hard' | null;
};

const toNumberArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
};

const extractTopicFiltersFromSection = (
  section?: AssessmentSection | null
): {
  primaryTopicIds: number[];
  secondaryTopicIds: number[];
  excludedTopicIds: number[];
} => {
  if (!section?.topicFilters || typeof section.topicFilters !== 'object') {
    return { primaryTopicIds: [], secondaryTopicIds: [], excludedTopicIds: [] };
  }
  const filters = section.topicFilters as Record<string, unknown>;
  const resolve = (keys: string[]) => {
    for (const key of keys) {
      const value = filters[key];
      if (Array.isArray(value)) {
        return toNumberArray(value);
      }
    }
    return [];
  };
  return {
    primaryTopicIds: resolve(['primaryTopicIds', 'primary_topic_ids']),
    secondaryTopicIds: resolve(['secondaryTopicIds', 'secondary_topic_ids']),
    excludedTopicIds: resolve(['excludedTopicIds', 'excluded_topic_ids'])
  };
};

const extractMetadataValue = <T,>(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
  fallback: T
): T => {
  if (!metadata || typeof metadata !== 'object') return fallback;
  const value = metadata[key];
  return (value as T) ?? fallback;
};

const normalizeQuestionTypes = (types: unknown): QuestionType[] => {
  if (!Array.isArray(types)) return [];
  return types
    .map((type) => (typeof type === 'string' ? type.trim().toUpperCase() : ''))
    .filter((type): type is QuestionType => QUESTION_TYPES.includes(type as QuestionType));
};

const deriveQuestionTypesFromSection = (section?: AssessmentSection | null): QuestionType[] => {
  if (!section) return [];
  const metadataTypes = normalizeQuestionTypes((section.metadata as any)?.questionTypes);
  if (metadataTypes.length > 0) return metadataTypes;
  if (typeof section.sectionType === 'string') {
    const parsed = section.sectionType
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter((item): item is QuestionType => QUESTION_TYPES.includes(item as QuestionType));
    if (parsed.length > 0) return parsed;
  }
  return [];
};

const buildDraftFromSection = (
  section: AssessmentSection
): { filters: QuestionSearchFilters; payload: AssessmentSectionCreateInput } => {
  const topicFilters = extractTopicFiltersFromSection(section);
  const questionTypes =
    deriveQuestionTypesFromSection(section).length > 0
      ? deriveQuestionTypesFromSection(section)
      : ['MCQ'];
  const metadata = (section.metadata as Record<string, unknown>) || {};
  const selectedReasoning =
    (metadata.selectedReasoning as keyof ReasoningDataState) ?? 'factual';
  const questionTarget =
    typeof metadata.questionTarget === 'number' ? metadata.questionTarget : 10;
  const reasoningData = section.reasoningData ?? defaultReasoningData();
  const difficultySettings =
    section.difficultySettings ?? {
      easyBoundary: reasoningData[selectedReasoning].easyBoundary,
      hardBoundary: reasoningData[selectedReasoning].hardBoundary
    };

  const payload: AssessmentSectionCreateInput = {
    name: section.name,
    sectionType: questionTypes.join(', '),
    questionTypes,
    topicFilters,
    metadata: {
      ...metadata,
      questionTarget,
      selectedReasoning,
      questionTypes
    },
    reasoningData,
    difficultySettings
  };

  const difficulty = metadata.difficulty && ['easy', 'medium', 'hard'].includes(metadata.difficulty as string)
    ? (metadata.difficulty as 'easy' | 'medium' | 'hard')
    : null;

  const filters: QuestionSearchFilters = {
    questionTypes,
    primaryTopicIds: topicFilters.primaryTopicIds,
    secondaryTopicIds: topicFilters.secondaryTopicIds,
    excludedTopicIds: topicFilters.excludedTopicIds,
    difficulty
  };

  return { filters, payload };
};

const collectSecondaryTopicIds = (question: Question): number[] => {
  return Array.from(
    new Set(
      (question.variants ?? []).flatMap((variant) => variant.secondaryTopicsId ?? [])
    )
  ).filter((id): id is number => typeof id === 'number');
};

const questionMatchesFilters = (question: Question, filters: QuestionSearchFilters): boolean => {
  const matchesType =
    filters.questionTypes.length === 0 || filters.questionTypes.includes(question.type);

  const secondaryIds = collectSecondaryTopicIds(question);
  const hasPrimaryMatch =
    filters.primaryTopicIds.length === 0
      ? false
      : filters.primaryTopicIds.includes(question.primaryTopicId);
  const hasSecondaryMatch =
    filters.secondaryTopicIds.length === 0
      ? false
      : secondaryIds.some((id) => filters.secondaryTopicIds.includes(id));

  const matchesTopic =
    filters.primaryTopicIds.length === 0 && filters.secondaryTopicIds.length === 0
      ? true
      : hasPrimaryMatch || hasSecondaryMatch;

  const isExcluded =
    filters.excludedTopicIds.includes(question.primaryTopicId) ||
    secondaryIds.some((topicId) => filters.excludedTopicIds.includes(topicId));

  // Filter by difficulty if specified
  const matchesDifficulty =
    !filters.difficulty ||
    (question.variants ?? []).some((variant) => variant.difficulty === filters.difficulty);

  return matchesType && matchesTopic && !isExcluded && matchesDifficulty;
};

const MultiSelectDropdown = ({
  label,
  options,
  selectedIds,
  onChange,
  disabledIds = new Set<number>()
}: {
  label: string;
  options: Topic[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  disabledIds?: Set<number>;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (id: number) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((value) => value !== id)
        : [...selectedIds, id]
    );
  };

  const selectedNames = options
    .filter((topic) => selectedIds.includes(topic.id))
    .map((topic) => topic.name);

  return (
    <div className="space-y-1" ref={containerRef}>
      <Label className="text-xs uppercase text-muted-foreground">{label}</Label>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded border border-gray-300 bg-white px-3 py-2 text-left text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <span>
          {selectedNames.length > 0 ? `${selectedNames.length} selected` : 'Select topics'}
        </span>
        <ChevronDown className="h-4 w-4 opacity-60" />
      </button>
      {isOpen && (
        <div className="z-20 mt-1 max-h-56 w-full rounded border border-gray-200 bg-white shadow-lg">
          <div className="max-h-56 overflow-y-auto text-sm">
            {options.length === 0 && (
              <div className="px-3 py-2 text-muted-foreground">No topics available</div>
            )}
            {options.map((topic) => (
              <label
                key={topic.id}
                className={`flex items-center gap-2 px-3 py-2 ${
                  disabledIds.has(topic.id)
                    ? 'cursor-not-allowed text-muted-foreground'
                    : 'cursor-pointer hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={disabledIds.has(topic.id)}
                  checked={selectedIds.includes(topic.id)}
                  onChange={() => toggleOption(topic.id)}
                  className="rounded border-gray-300"
                />
                <span>{topic.name}</span>
              </label>
            ))}
          </div>
          <div className="border-t px-3 py-2 text-right">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange([])}
              className="text-xs text-muted-foreground"
            >
              Clear
            </Button>
          </div>
        </div>
      )}
      {selectedNames.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Selected: {selectedNames.join(', ')}
        </p>
      )}
    </div>
  );
};

const SectionCard = ({
  section,
  onEdit,
  onDelete,
  onDeleteVariant
}: {
  section: AssessmentSection;
  onEdit: (section: AssessmentSection) => void;
  onDelete: (section: AssessmentSection) => void;
  onDeleteVariant: (sectionId: number, variantId: number) => void;
}) => {
  const questionCount = section.sectionVariants?.length ?? 0;

  return (
    <Card className="border border-gray-200">
      <CardHeader className="flex flex-col gap-3 space-y-0 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col">
          <CardTitle className="text-lg">{section.name}</CardTitle>
          {section.sectionType && (
            <p className="text-sm text-muted-foreground capitalize">{section.sectionType}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {questionCount} question{questionCount === 1 ? '' : 's'}
          </Badge>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => onEdit(section)}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(section)}>
              Delete
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {section.description && (
          <p className="text-sm text-muted-foreground">{section.description}</p>
        )}

        <div className="rounded border border-gray-100 bg-gray-50 p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Questions
          </h4>
          {questionCount > 0 ? (
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {(section.sectionVariants ?? [])
                .slice()
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((link: SectionVariantLink) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between gap-2 rounded border border-gray-200 bg-white p-2 text-sm text-gray-700"
                  >
                    <span className="flex-1">{link.variant?.questionText ?? 'Untitled question'}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (link.variantId) {
                          onDeleteVariant(section.id, link.variantId);
                        }
                      }}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </div>
          ) : (
            <div className="rounded border border-dashed border-gray-200 p-4 text-center text-sm text-muted-foreground">
              No questions yet. Add some when configuring this section.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface CreateSectionPanelProps {
  isSearching: boolean;
  onSearchQuestions: (
    filters: QuestionSearchFilters,
    payload: AssessmentSectionCreateInput,
    existingSectionId?: number
  ) => Promise<void>;
  onCancel: () => void;
  blueprint?: AssessmentBlueprintConfig | null;
  availableTopics: Topic[];
  defaultPrimaryTopics: number[];
  defaultSecondaryTopics: number[];
  defaultExcludedTopics: number[];
  mode: 'create' | 'edit';
  editingSection?: AssessmentSection | null;
}

const CreateSectionPanel = ({
  isSearching,
  onSearchQuestions,
  onCancel,
  blueprint,
  availableTopics,
  defaultPrimaryTopics,
  defaultSecondaryTopics,
  defaultExcludedTopics,
  mode,
  editingSection
}: CreateSectionPanelProps) => {
  const isEditing = mode === 'edit' && Boolean(editingSection);
  const sanitizedDefaults = useMemo(
    () => sanitizeTopicGroups(defaultPrimaryTopics, defaultSecondaryTopics, defaultExcludedTopics),
    [defaultPrimaryTopics, defaultSecondaryTopics, defaultExcludedTopics]
  );
  const {
    primary: primaryDefaults,
    secondary: secondaryDefaults,
    excluded: excludedDefaults
  } = sanitizedDefaults;
  const [sectionName, setSectionName] = useState('');
  const [sectionTypeOptions] = useState<QuestionType[]>(QUESTION_TYPES);
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>(['MCQ']);
  const [primaryTopicIds, setPrimaryTopicIds] = useState<number[]>(primaryDefaults);
  const [secondaryTopicIds, setSecondaryTopicIds] = useState<number[]>(secondaryDefaults);
  const [excludedTopicIds, setExcludedTopicIds] = useState<number[]>(excludedDefaults);
  const [reasoningData, setReasoningData] = useState<ReasoningDataState>(defaultReasoningData());
  const [selectedReasoning, setSelectedReasoning] = useState<keyof ReasoningDataState>('factual');
  const [questionTarget, setQuestionTarget] = useState(10);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard' | null>(null);

  const primaryDisabledIds = useMemo(
    () => new Set([...secondaryTopicIds, ...excludedTopicIds]),
    [secondaryTopicIds, excludedTopicIds]
  );
  const secondaryDisabledIds = useMemo(
    () => new Set([...primaryTopicIds, ...excludedTopicIds]),
    [primaryTopicIds, excludedTopicIds]
  );
  const excludedDisabledIds = useMemo(
    () => new Set([...primaryTopicIds, ...secondaryTopicIds]),
    [primaryTopicIds, secondaryTopicIds]
  );

  useEffect(() => {
    if (isEditing || !blueprint) return;
    const sanitizedFromBlueprint = sanitizeTopicGroups(
      blueprint.primaryTopicIds ?? [],
      blueprint.secondaryTopicIds ?? [],
      blueprint.excludedTopicIds ?? []
    );
    setPrimaryTopicIds(sanitizedFromBlueprint.primary);
    setSecondaryTopicIds(sanitizedFromBlueprint.secondary);
    setExcludedTopicIds(sanitizedFromBlueprint.excluded);

    if (blueprint.reasoningData) {
      setReasoningData(blueprint.reasoningData);
    } else if (blueprint.reasoningDistribution) {
      const totals = blueprint.reasoningDistribution;
      setReasoningData((prev) => ({
        factual: { ...prev.factual, total: totals.factual ?? prev.factual.total },
        analytical: { ...prev.analytical, total: totals.analytical ?? prev.analytical.total },
        application: { ...prev.application, total: totals.application ?? prev.application.total }
      }));
      const favored = (['factual', 'analytical', 'application'] as Array<keyof ReasoningDataState>).reduce(
        (best, key) =>
          (totals[key] ?? 0) > (totals[best] ?? 0) ? key : best,
        'factual' as keyof ReasoningDataState
      );
      setSelectedReasoning(favored || 'factual');
    } else {
      setReasoningData(defaultReasoningData());
      setSelectedReasoning('factual');
    }
  }, [blueprint, isEditing]);

  useEffect(() => {
    if (isEditing) return;
    setPrimaryTopicIds(primaryDefaults);
    setSecondaryTopicIds(secondaryDefaults);
    setExcludedTopicIds(excludedDefaults);
  }, [primaryDefaults, secondaryDefaults, excludedDefaults, isEditing]);

  useEffect(() => {
    if (!isEditing || !editingSection) return;
    const topicFilters = extractTopicFiltersFromSection(editingSection);
    setSectionName(editingSection.name ?? '');
    const typesFromSection = deriveQuestionTypesFromSection(editingSection);
    setSelectedTypes(typesFromSection.length > 0 ? typesFromSection : ['MCQ']);
    setPrimaryTopicIds(topicFilters.primaryTopicIds);
    setSecondaryTopicIds(topicFilters.secondaryTopicIds);
    setExcludedTopicIds(topicFilters.excludedTopicIds);
    const metadata = (editingSection.metadata as Record<string, unknown>) || {};
    const target =
      typeof metadata.questionTarget === 'number' ? metadata.questionTarget : 10;
    setQuestionTarget(target);
    const selected =
      (metadata.selectedReasoning as keyof ReasoningDataState) ?? 'factual';
    setSelectedReasoning(selected);
    const difficulty = metadata.difficulty && ['easy', 'medium', 'hard'].includes(metadata.difficulty as string)
      ? (metadata.difficulty as 'easy' | 'medium' | 'hard')
      : null;
    setSelectedDifficulty(difficulty);
    if (editingSection.reasoningData) {
      setReasoningData(editingSection.reasoningData);
    } else {
      setReasoningData(defaultReasoningData());
    }
  }, [editingSection, isEditing]);

  useEffect(() => {
    if (isEditing) return;
    setSectionName('');
    setSelectedTypes(['MCQ']);
    setQuestionTarget(10);
    setSelectedReasoning('factual');
    setSelectedDifficulty(null);
    setReasoningData(defaultReasoningData());
  }, [isEditing]);

  const toggleType = (type: QuestionType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
    );
  };

  const handleTopicSelectionChange = (
    group: 'primary' | 'secondary' | 'excluded',
    ids: number[]
  ) => {
    const unique = Array.from(new Set(ids));
    const selectionSet = new Set(unique);

    if (group === 'primary') {
      setPrimaryTopicIds(unique);
      setSecondaryTopicIds((prev) => prev.filter((id) => !selectionSet.has(id)));
      setExcludedTopicIds((prev) => prev.filter((id) => !selectionSet.has(id)));
      return;
    }

    if (group === 'secondary') {
      setSecondaryTopicIds(unique);
      setPrimaryTopicIds((prev) => prev.filter((id) => !selectionSet.has(id)));
      setExcludedTopicIds((prev) => prev.filter((id) => !selectionSet.has(id)));
      return;
    }

    setExcludedTopicIds(unique);
    setPrimaryTopicIds((prev) => prev.filter((id) => !selectionSet.has(id)));
    setSecondaryTopicIds((prev) => prev.filter((id) => !selectionSet.has(id)));
  };

  const handleSubmit = async () => {
    if (!sectionName.trim()) return;

    const normalizedReasoningData: ReasoningDataState = {
      factual: {
        ...reasoningData.factual,
        total: selectedReasoning === 'factual' ? 100 : 0
      },
      analytical: {
        ...reasoningData.analytical,
        total: selectedReasoning === 'analytical' ? 100 : 0
      },
      application: {
        ...reasoningData.application,
        total: selectedReasoning === 'application' ? 100 : 0
      }
    };

    const payload: AssessmentSectionCreateInput = {
      name: sectionName.trim(),
      sectionType: selectedTypes.join(', '),
      questionTypes: selectedTypes,
      topicFilters: {
        primaryTopicIds,
        secondaryTopicIds,
        excludedTopicIds
      },
      metadata: {
        questionTarget,
        selectedReasoning,
        questionTypes: selectedTypes,
        difficulty: selectedDifficulty
      },
      reasoningData: normalizedReasoningData,
      difficultySettings: {
        easyBoundary: normalizedReasoningData[selectedReasoning].easyBoundary,
        hardBoundary: normalizedReasoningData[selectedReasoning].hardBoundary
      }
    };

    await onSearchQuestions(
      {
        questionTypes: selectedTypes,
        primaryTopicIds,
        secondaryTopicIds,
        excludedTopicIds,
        difficulty: selectedDifficulty
      },
      payload,
      editingSection?.id
    );
  };

  const handleDifficultyChange = (difficulty: 'easy' | 'medium' | 'hard') => {
    // Toggle: if clicking the same difficulty, deselect it
    setSelectedDifficulty(selectedDifficulty === difficulty ? null : difficulty);
  };

  return (
    <Card className="border border-gray-200">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{isEditing ? 'Edit Section' : 'Create Section'}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="section-name">Section Name</Label>
            <Input
              id="section-name"
              placeholder="e.g., Multiple Choice Questions"
              value={sectionName}
              onChange={(event) => setSectionName(event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Question Types</Label>
          <div className="flex flex-wrap gap-2">
            {sectionTypeOptions.map((type) => (
              <Button
                key={type}
                type="button"
                variant={selectedTypes.includes(type) ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleType(type)}
              >
                {type}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Label>Topics</Label>
          <div className="space-y-4">
            <MultiSelectDropdown
              label="Primary"
              options={availableTopics}
              selectedIds={primaryTopicIds}
              onChange={(ids) => handleTopicSelectionChange('primary', ids)}
              disabledIds={primaryDisabledIds}
            />
            <MultiSelectDropdown
              label="Secondary"
              options={availableTopics}
              selectedIds={secondaryTopicIds}
              onChange={(ids) => handleTopicSelectionChange('secondary', ids)}
              disabledIds={secondaryDisabledIds}
            />
            <MultiSelectDropdown
              label="Exclusion"
              options={availableTopics}
              selectedIds={excludedTopicIds}
              onChange={(ids) => handleTopicSelectionChange('excluded', ids)}
              disabledIds={excludedDisabledIds}
            />
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reasoning Focus</Label>
            <div className="flex flex-wrap gap-2">
              {(['factual', 'analytical', 'application'] as Array<keyof ReasoningDataState>).map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant={selectedReasoning === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedReasoning(type)}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Difficulty Level</Label>
            <div className="flex flex-wrap gap-2">
              {(['easy', 'medium', 'hard'] as const).map((level) => (
                <Button
                  key={level}
                  type="button"
                  variant={selectedDifficulty === level ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleDifficultyChange(level)}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <Button
          className="w-full"
          disabled={isSearching || !sectionName.trim()}
          onClick={handleSubmit}
        >
          {isSearching ? 'Searching...' : isEditing ? 'Update Search' : 'Search Questions'}
        </Button>
      </CardContent>
    </Card>
  );
};

interface MatchingQuestionsPanelProps {
  questions: Question[];
  selectedQuestionIds: Set<number>;
  onToggleQuestion: (question: Question) => void;
  onClearSelection: () => void;
  onAddSelected: () => void;
  onCreateNewQuestion: () => void;
  onAddVariant: (question: Question) => void;
  isSearching: boolean;
  isCreatingSection: boolean;
  searchError: string | null;
  hasSearched: boolean;
  topicsById: Record<number, Topic>;
  canFinalizeSection: boolean;
}

const getTopicName = (topicsById: Record<number, Topic>, topicId?: number | null) => {
  if (!topicId) return 'Unassigned topic';
  const topic = topicsById[topicId];
  return topic ? topic.name : `Topic #${topicId}`;
};

const MatchingQuestionsPanel = ({
  questions,
  selectedQuestionIds,
  onToggleQuestion,
  onClearSelection,
  onAddSelected,
  onCreateNewQuestion,
  onAddVariant,
  isSearching,
  isCreatingSection,
  searchError,
  hasSearched,
  topicsById,
  canFinalizeSection
}: MatchingQuestionsPanelProps) => {
  const selectedCount = selectedQuestionIds.size;

  const renderContent = () => {
    if (isSearching) {
      return (
        <div className="rounded border border-dashed border-gray-200 p-6 text-center text-sm text-muted-foreground">
          Searching for matching questions…
        </div>
      );
    }

    if (searchError) {
      return (
        <div className="rounded border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          {searchError}
        </div>
      );
    }

    if (!hasSearched) {
      return (
        <div className="rounded border border-dashed border-gray-200 p-6 text-center text-sm text-muted-foreground">
          Configure filters and run “Search Questions” to see matches here.
        </div>
      );
    }

    if (questions.length === 0) {
      return (
        <div className="rounded border border-dashed border-gray-200 p-6 text-center text-sm text-muted-foreground">
          No questions matched your filters. Try broadening the search or create a new question.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
          {questions.map((question) => {
            const isSelected = selectedQuestionIds.has(question.id);
            const primaryVariant = question.variants?.[0];
            const displayText =
              primaryVariant?.questionText ||
              question.description ||
              `Question #${question.id}`;
            const secondaryTopicNames = Array.from(
              new Set(
                (question.variants ?? []).flatMap((variant) => variant.secondaryTopicsId ?? [])
              )
            )
              .map((topicId) => topicsById[topicId]?.name)
              .filter(Boolean) as string[];

            return (
              <div
                key={question.id}
                onClick={() => onToggleQuestion(question)}
                className={`flex items-start gap-3 rounded border px-3 py-3 text-sm cursor-pointer ${
                  isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleQuestion(question)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 h-4 w-4 rounded border-gray-300 cursor-pointer"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{question.type}</Badge>
                    <p className="font-medium flex-1">{displayText}</p>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddVariant(question);
                      }}
                      className="text-xs bg-black text-white hover:bg-gray-800"
                    >
                      Variant
                    </Button>
                  </div>
                  {primaryVariant?.questionText && question.description && (
                    <p className="text-xs text-muted-foreground">{question.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Primary: {getTopicName(topicsById, question.primaryTopicId)}
                  </p>
                  {secondaryTopicNames.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Secondary: {secondaryTopicNames.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card className="border border-gray-200">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Matching Questions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Filtered results from your course question bank.
          </p>
        </div>
        <Badge variant="outline">{questions.length} found</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderContent()}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span>{selectedCount} selected</span>
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={onClearSelection}
                className="text-xs font-medium text-primary hover:underline"
              >
                Clear selection
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onCreateNewQuestion}>
              Create New Question
            </Button>
            <Button
              type="button"
              disabled={selectedCount === 0 || !canFinalizeSection || isCreatingSection}
              onClick={onAddSelected}
            >
              {isCreatingSection ? 'Adding...' : 'Save to Section'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const AssessmentViewPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const assessmentId = Number(id);
  const { toast } = useToast();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [sections, setSections] = useState<AssessmentSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBuilderVisible, setIsBuilderVisible] = useState(false);
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([]);
  const [matchingQuestions, setMatchingQuestions] = useState<Question[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<number>>(new Set());
  const [selectedVariantByQuestion, setSelectedVariantByQuestion] = useState<Record<number, number>>(
    {}
  );
  const [isSearchingQuestions, setIsSearchingQuestions] = useState(false);
  const [isCreatingSection, setIsCreatingSection] = useState(false);
  const [questionSearchError, setQuestionSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [pendingSectionDraft, setPendingSectionDraft] =
    useState<AssessmentSectionCreateInput | null>(null);
  const [pendingSectionId, setPendingSectionId] = useState<number | null>(null);
  const [editingSection, setEditingSection] = useState<AssessmentSection | null>(null);
  const [isDeletingAssessment, setIsDeletingAssessment] = useState(false);
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [presetVariant, setPresetVariant] = useState<QuestionVariantEntry | null>(null);
  const [isCanvasExportOpen, setIsCanvasExportOpen] = useState(false);
  const [lastFilters, setLastFilters] = useState<QuestionSearchFilters | null>(null);

  const resetBuilderContext = () => {
    setMatchingQuestions([]);
    setSelectedQuestionIds(new Set());
    setSelectedVariantByQuestion({});
    setHasSearched(false);
    setQuestionSearchError(null);
    setPendingSectionDraft(null);
    setPendingSectionId(null);
    setLastFilters(null);
    setIsAddQuestionOpen(false);
  };

  const handleCancelBuilder = () => {
    resetBuilderContext();
    setEditingSection(null);
    setIsBuilderVisible(false);
  };

  useEffect(() => {
    const load = async () => {
      if (Number.isNaN(assessmentId)) return;
      try {
        setIsLoading(true);
        setError(null);
        const data = await assessmentService.getAssessment(assessmentId);
        setAssessment(data);
        setSections((data.sections ?? []).slice().sort((a, b) => a.position - b.position));
      } catch (loadError: any) {
        setError(loadError?.response?.data?.error || 'Failed to load assessment');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [assessmentId]);

  useEffect(() => {
    const loadTopics = async () => {
      if (!assessment?.course?.id || !isBuilderVisible) return;
      try {
        const topics = await courseService.getCourseTopics(assessment.course.id);
        setAvailableTopics(topics);
      } catch (_error) {
        setAvailableTopics([]);
      }
    };

    loadTopics();
  }, [assessment?.course?.id, isBuilderVisible, assessment]);

  useEffect(() => {
    if (!isBuilderVisible) {
      resetBuilderContext();
    }
  }, [isBuilderVisible]);

  const topicsById = useMemo(() => {
    const map: Record<number, Topic> = {};
    availableTopics.forEach((topic) => {
      map[topic.id] = topic;
    });
    return map;
  }, [availableTopics]);

  const questionVariantEntries = useMemo<QuestionVariantEntry[]>(() => {
    const resolveTopicName = (topicId: number) => topicsById[topicId]?.name ?? `Topic ${topicId}`;
    return matchingQuestions.flatMap((question) =>
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
          isAiGenerated: question.isAiGenerated,
          variant
        };
      })
    );
  }, [matchingQuestions, topicsById]);

  const handleSectionSearch = async (
    filters: QuestionSearchFilters,
    payload: AssessmentSectionCreateInput,
    existingSectionId?: number | null
  ) => {
    if (!assessment?.course?.id) {
      setQuestionSearchError('Course information is required to search questions.');
      setHasSearched(true);
      setPendingSectionDraft(null);
       setPendingSectionId(null);
      return;
    }

    setIsSearchingQuestions(true);
    setQuestionSearchError(null);
    setHasSearched(true);
    setPendingSectionDraft(payload);
    setPendingSectionId(existingSectionId ?? null);
    setLastFilters(filters);
    try {
      const questions = await questionService.getQuestions({
        courseId: assessment.course.id,
        limit: 200
      });
      const filtered = questions.filter((question) => questionMatchesFilters(question, filters));
      setMatchingQuestions(filtered);
      if (existingSectionId) {
        setSelectedQuestionIds((prev) => {
          const next = new Set<number>();
          filtered.forEach((question) => {
            if (prev.has(question.id)) {
              next.add(question.id);
            }
          });
          return next;
        });
        setSelectedVariantByQuestion((prev) => {
          const next: Record<number, number> = {};
          filtered.forEach((question) => {
            if (prev[question.id]) {
              next[question.id] = prev[question.id];
            } else if (question.variants?.[0]?.id) {
              next[question.id] = question.variants[0].id;
            }
          });
          return next;
        });
      } else {
        setSelectedQuestionIds(new Set());
        setSelectedVariantByQuestion({});
      }
    } catch (_error) {
      setQuestionSearchError('Failed to search for questions. Please try again.');
      setPendingSectionDraft(null);
      setPendingSectionId(null);
    } finally {
      setIsSearchingQuestions(false);
    }
  };

  const handleToggleQuestionSelection = (question: Question) => {
    const questionId = question.id;
    const isSelected = selectedQuestionIds.has(questionId);
    const defaultVariantId = question.variants?.[0]?.id;
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (isSelected) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
    setSelectedVariantByQuestion((prev) => {
      const next = { ...prev };
      if (isSelected) {
        delete next[questionId];
      } else if (defaultVariantId) {
        next[questionId] = defaultVariantId;
      }
      return next;
    });
  };

  const clearQuestionSelection = () => {
    setSelectedQuestionIds(new Set());
    setSelectedVariantByQuestion({});
  };

  const handleCreateNewQuestion = () => {
    if (!assessment?.course?.id) {
      toast({
        title: 'Select a course first',
        description: 'Unable to create a question without course context.',
        variant: 'destructive'
      });
      return;
    }
    setPresetVariant(null);
    setIsAddQuestionOpen(true);
  };

  const handleAddVariant = (question: Question) => {
    if (!assessment?.course?.id) {
      toast({
        title: 'Select a course first',
        description: 'Unable to add a variant without course context.',
        variant: 'destructive'
      });
      return;
    }
    const primaryVariant = question.variants?.[0];
    if (!primaryVariant) {
      toast({
        title: 'No variant available',
        description: 'This question has no variants to base a new variant on.',
        variant: 'destructive'
      });
      return;
    }
    // Create a variant entry with the current assessment preselected
    const variantWithAssessment = {
      ...primaryVariant,
      assessmentId: assessment?.id ?? primaryVariant.assessmentId
    };
    const variantEntry: QuestionVariantEntry = {
      questionId: question.id,
      questionDescription: question.description,
      questionType: question.type,
      primaryTopicId: question.primaryTopicId,
      primaryTopicName: availableTopics.find((t) => t.id === question.primaryTopicId)?.name,
      courseId: question.courseId,
      courseName: question.course?.name,
      courseCode: question.course?.code,
      secondaryTopicNames: primaryVariant.secondaryTopicsId
        ?.map((id) => availableTopics.find((t) => t.id === id)?.name)
        .filter(Boolean) as string[] | undefined,
      isAiGenerated: question.isAiGenerated,
      variant: variantWithAssessment
    };
    setPresetVariant(variantEntry);
    setIsAddQuestionOpen(true);
  };

  const handleQuestionCreated = (newQuestion: Question) => {
    setIsAddQuestionOpen(false);
    if (lastFilters && pendingSectionDraft) {
      void handleSectionSearch(lastFilters, pendingSectionDraft, pendingSectionId);
      return;
    }
    setMatchingQuestions((prev) => {
      const filtered = prev.filter((question) => question.id !== newQuestion.id);
      return [newQuestion, ...filtered];
    });
  };

  const handleDeleteAssessment = async () => {
    if (!assessment) return;
    const confirmed = window.confirm(
      `Delete assessment "${assessment.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;
    try {
      setIsDeletingAssessment(true);
      await assessmentService.deleteAssessment(assessment.id);
      toast({
        title: 'Assessment deleted',
        description: `"${assessment.name}" has been removed.`
      });
      navigate('/landing');
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

  const startCreateSection = () => {
    resetBuilderContext();
    setEditingSection(null);
    setIsBuilderVisible(true);
  };

  const primeSelectionFromSection = (section: AssessmentSection) => {
    const nextIds = new Set<number>();
    const variantMap: Record<number, number> = {};
    (section.sectionVariants ?? []).forEach((link) => {
      const questionId =
        link.variant?.questionMetadata?.id ??
        link.variant?.questionMetadataId ??
        (link.variant as any)?.questionMetadataId ??
        null;
      if (questionId) {
        nextIds.add(questionId);
        if (link.variantId) {
          variantMap[questionId] = link.variantId;
        }
      }
    });
    if (nextIds.size > 0) {
      setSelectedQuestionIds(nextIds);
      setSelectedVariantByQuestion(variantMap);
    } else {
      setSelectedQuestionIds(new Set());
      setSelectedVariantByQuestion({});
    }
  };

  const refreshSections = async () => {
    if (!assessment) return;
    const updatedSections = await assessmentService.getAssessmentSections(assessment.id);
    setSections(updatedSections.slice().sort((a, b) => a.position - b.position));
  };

  const handleEditSection = async (section: AssessmentSection) => {
    resetBuilderContext();
    setEditingSection(section);
    primeSelectionFromSection(section);
    setIsBuilderVisible(true);
    const { filters, payload } = buildDraftFromSection(section);
    try {
      await handleSectionSearch(filters, payload, section.id);
    } catch {
      // errors are surfaced via toast/error state in handleSectionSearch
    }
  };

  const handleDeleteSection = async (section: AssessmentSection) => {
    if (!assessment) return;
    const confirmed = window.confirm(
      `Delete section "${section.name}"? This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await assessmentService.deleteSection(assessment.id, section.id);
      if (editingSection?.id === section.id) {
        handleCancelBuilder();
      }
      await refreshSections();
      toast({
        title: 'Section deleted',
        description: `"${section.name}" has been removed.`
      });
    } catch (_error) {
      toast({
        title: 'Failed to delete section',
        description: 'Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteVariantFromSection = async (sectionId: number, variantId: number) => {
    if (!assessment) return;
    const confirmed = window.confirm(
      'Remove this question from the section?'
    );
    if (!confirmed) return;
    try {
      await assessmentService.removeVariantFromSection(assessment.id, sectionId, variantId);
      await refreshSections();
      toast({
        title: 'Question removed',
        description: 'The question has been removed from this section.'
      });
    } catch (_error) {
      toast({
        title: 'Failed to remove question',
        description: 'Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleFinalizeSection = async () => {
    if (!assessment) return;
    if (!pendingSectionDraft) {
      toast({
        title: 'Section details required',
        description: 'Run “Search Questions” again to capture the section setup.',
        variant: 'destructive'
      });
      return;
    }

    if (selectedQuestionIds.size === 0) {
      toast({
        title: 'Select questions first',
        description: 'Choose at least one question before adding the section.',
        variant: 'destructive'
      });
      return;
    }

    const variantSelections = Array.from(selectedQuestionIds).map((questionId, index) => {
      const question = matchingQuestions.find((item) => item.id === questionId);
      const fallbackVariant = question?.variants?.[0]?.id;
      const variantId = selectedVariantByQuestion[questionId] ?? fallbackVariant;
      return {
        questionId,
        variantId,
        displayOrder: index
      };
    });

    const missingVariants = variantSelections.filter((entry) => !entry.variantId);
    if (missingVariants.length === variantSelections.length) {
      toast({
        title: 'No variants available',
        description: 'Selected questions do not have variants to attach.',
        variant: 'destructive'
      });
      return;
    }

    setIsCreatingSection(true);
    try {
      const payload: AssessmentSectionCreateInput = {
        ...pendingSectionDraft,
        metadata: {
          ...(pendingSectionDraft.metadata ?? {}),
          selectedQuestionIds: Array.from(selectedQuestionIds)
        }
      };

      let sectionId = pendingSectionId ?? null;
      if (pendingSectionId) {
        await assessmentService.updateSection(assessment.id, pendingSectionId, payload);
        // Get existing variant IDs to avoid duplicates
        const existingVariantIds = new Set(
          (editingSection?.sectionVariants ?? [])
            .map((link) => link.variantId)
            .filter((id): id is number => typeof id === 'number')
        );
        
        // Only add variants that aren't already in the section (additive behavior)
        const newVariantSelections = variantSelections.filter(
          (entry) => entry.variantId !== undefined && !existingVariantIds.has(entry.variantId as number)
        );
        
        // Calculate display order starting from the current max order
        const maxDisplayOrder = Math.max(
          ...(editingSection?.sectionVariants ?? []).map((link) => link.displayOrder ?? 0),
          -1
        );
        
        const successfulVariantAdds = await Promise.all(
          newVariantSelections.map((entry, index) =>
            assessmentService.addVariantToSection(assessment.id, pendingSectionId, {
              variantId: entry.variantId as number,
              displayOrder: maxDisplayOrder + 1 + index
            })
          )
        );
        
        await refreshSections();
        toast({
          title: 'Section updated',
          description: `${successfulVariantAdds.length} question${
            successfulVariantAdds.length === 1 ? '' : 's'
          } added to this section.`
        });
        handleCancelBuilder();
        return;
      } else {
        const newSection = await assessmentService.createSection(assessment.id, payload);
        sectionId = newSection.id;
      }

      const ensuredSectionId = sectionId as number;

      const successfulVariantAdds = await Promise.all(
        variantSelections
          .filter((entry) => entry.variantId !== undefined)
          .map((entry) =>
            assessmentService.addVariantToSection(assessment.id, ensuredSectionId, {
              variantId: entry.variantId as number,
              displayOrder: entry.displayOrder
            })
          )
      );

      if (missingVariants.length > 0) {
        toast({
          title: 'Some questions skipped',
          description: `${missingVariants.length} question${
            missingVariants.length === 1 ? '' : 's'
          } had no variants and were not added.`,
        });
      }

      await refreshSections();
      toast({
        title: pendingSectionId ? 'Section updated' : 'Section created',
        description: `${successfulVariantAdds.length} question${
          successfulVariantAdds.length === 1 ? '' : 's'
        } added to this section.`
      });
      handleCancelBuilder();
    } catch (_error) {
      toast({
        title: 'Failed to create section',
        description: 'Please try again in a moment.',
        variant: 'destructive'
      });
    } finally {
      setIsCreatingSection(false);
    }
  };

  const orderedSections = useMemo(
    () => sections.slice().sort((a, b) => a.position - b.position),
    [sections]
  );

  if (Number.isNaN(assessmentId)) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <p className="mt-4 text-sm text-red-600">Invalid assessment ID.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Layers3 className="h-4 w-4" />
            Assessment Sections
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">Loading assessment…</CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-center text-red-600">{error}</CardContent>
          </Card>
        ) : assessment ? (
          <>
            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-2xl">{assessment.name}</CardTitle>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline">{assessment.type}</Badge>
                    <Badge variant="outline">{assessment.semester}</Badge>
                    {assessment.course?.name && <Badge variant="outline">{assessment.course.name}</Badge>}
                  </div>
                  {assessment.description && <p className="text-sm text-muted-foreground">{assessment.description}</p>}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setIsCanvasExportOpen(true)}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Export to Canvas
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteAssessment}
                    disabled={isDeletingAssessment}
                  >
                    {isDeletingAssessment ? 'Deleting...' : 'Delete Assessment'}
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Sections</h2>
                  <p className="text-sm text-muted-foreground">
                    Arrange your assessment by sections. Each section can mix multiple question types.
                  </p>
                </div>
                <Button onClick={startCreateSection}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Section
                </Button>
              </div>

              {orderedSections.length === 0 ? (
                <div className="rounded border border-dashed border-gray-200 p-10 text-center text-muted-foreground">
                  No sections yet. Click “Add Section” to start composing this assessment.
                </div>
              ) : (
                <div className="space-y-3">
                  {orderedSections.map((section) => (
                    <SectionCard
                      key={section.id}
                      section={section}
                      onEdit={handleEditSection}
                      onDelete={handleDeleteSection}
                      onDeleteVariant={handleDeleteVariantFromSection}
                    />
                  ))}
                </div>
              )}
            </div>

            {isBuilderVisible && assessment && (
              <>
                <Separator />
                <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
                  <CreateSectionPanel
                    key={editingSection ? `edit-${editingSection.id}` : 'create'}
                    isSearching={isSearchingQuestions}
                    onSearchQuestions={handleSectionSearch}
                    onCancel={handleCancelBuilder}
                    blueprint={assessment.blueprintConfig}
                    availableTopics={availableTopics}
                    defaultPrimaryTopics={assessment.blueprintConfig?.primaryTopicIds ?? []}
                    defaultSecondaryTopics={assessment.blueprintConfig?.secondaryTopicIds ?? []}
                    defaultExcludedTopics={assessment.blueprintConfig?.excludedTopicIds ?? []}
                    mode={editingSection ? 'edit' : 'create'}
                    editingSection={editingSection}
                  />
                  <MatchingQuestionsPanel
                    questions={matchingQuestions}
                    selectedQuestionIds={selectedQuestionIds}
                    onToggleQuestion={handleToggleQuestionSelection}
                    onClearSelection={clearQuestionSelection}
                    onAddSelected={handleFinalizeSection}
                    onCreateNewQuestion={handleCreateNewQuestion}
                    onAddVariant={handleAddVariant}
                    isSearching={isSearchingQuestions}
                    isCreatingSection={isCreatingSection}
                    searchError={questionSearchError}
                    hasSearched={hasSearched}
                    topicsById={topicsById}
                    canFinalizeSection={Boolean(pendingSectionDraft)}
                  />
                </div>
              </>
            )}
          </>
        ) : null}
      </div>
      <AddQuestionDialog
        open={isAddQuestionOpen}
        onClose={() => {
          setIsAddQuestionOpen(false);
          setPresetVariant(null);
        }}
        courseId={assessment?.course?.id ?? null}
        variants={questionVariantEntries}
        onQuestionCreated={handleQuestionCreated}
        presetVariant={presetVariant}
      />
      {assessment && (
        <CanvasExportDialog
          open={isCanvasExportOpen}
          onClose={() => setIsCanvasExportOpen(false)}
          assessmentId={assessment.id}
          assessmentName={assessment.name}
          onExportSuccess={(result) => {
            toast({
              title: 'Export successful!',
              description: `Assessment exported to Canvas. Quiz ID: ${result.quizId}`,
            });
          }}
        />
      )}
    </div>
  );
};

export default AssessmentViewPage;
