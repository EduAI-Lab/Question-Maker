import { useEffect, useMemo, useState } from 'react';
import {
  AssessmentBlueprintConfig,
  AssessmentSection,
  AssessmentSectionCreateInput,
  QuestionType,
  ReasoningDataState
} from '../../types/question';
import { Topic } from '../../types/topic';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Tooltip } from '../../components/ui/tooltip';
import { MultiSelectDropdown } from './MultiSelectDropdown';
import {
  sanitizeTopicGroups,
  extractTopicFiltersFromSection,
  deriveQuestionTypesFromSection
} from './assessmentViewUtils';
import {
  QuestionSearchFilters,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  defaultReasoningData
} from './assessmentViewTypes';

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

export const CreateSectionPanel = ({
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
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>([]);
  const [primaryTopicIds, setPrimaryTopicIds] = useState<number[]>(primaryDefaults);
  const [secondaryTopicIds, setSecondaryTopicIds] = useState<number[]>(secondaryDefaults);
  const [excludedTopicIds, setExcludedTopicIds] = useState<number[]>(excludedDefaults);
  const [reasoningData, setReasoningData] = useState<ReasoningDataState>(defaultReasoningData());
  const [selectedReasoning, setSelectedReasoning] = useState<Array<keyof ReasoningDataState>>([]);
  const [questionTarget, setQuestionTarget] = useState(10);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Array<'easy' | 'medium' | 'hard'>>([]);

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
      setSelectedReasoning(favored ? [favored] : []);
    } else {
      setReasoningData(defaultReasoningData());
      setSelectedReasoning([]);
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
    setSelectedTypes(typesFromSection);
    setPrimaryTopicIds(topicFilters.primaryTopicIds);
    setSecondaryTopicIds(topicFilters.secondaryTopicIds);
    setExcludedTopicIds(topicFilters.excludedTopicIds);
    const metadata = (editingSection.metadata as Record<string, unknown>) || {};
    const target =
      typeof metadata.questionTarget === 'number' ? metadata.questionTarget : 10;
    setQuestionTarget(target);
    const selected = metadata.selectedReasoning;
    if (Array.isArray(selected)) {
      setSelectedReasoning(selected.filter((r): r is keyof ReasoningDataState =>
        ['factual', 'analytical', 'application'].includes(r as string)
      ));
    } else if (selected && ['factual', 'analytical', 'application'].includes(selected as string)) {
      setSelectedReasoning([selected as keyof ReasoningDataState]);
    } else {
      setSelectedReasoning([]);
    }

    const difficulty = metadata.difficulty;
    if (Array.isArray(difficulty)) {
      setSelectedDifficulty(difficulty.filter((d): d is 'easy' | 'medium' | 'hard' =>
        ['easy', 'medium', 'hard'].includes(d as string)
      ));
    } else if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty as string)) {
      setSelectedDifficulty([difficulty as 'easy' | 'medium' | 'hard']);
    } else {
      setSelectedDifficulty([]);
    }
    if ((editingSection as any).reasoningData) {
      setReasoningData((editingSection as any).reasoningData);
    } else {
      setReasoningData(defaultReasoningData());
    }
  }, [editingSection, isEditing]);

  useEffect(() => {
    if (isEditing) return;
    setSectionName('');
    setSelectedTypes([]);
    setQuestionTarget(10);
    setSelectedReasoning([]);
    setSelectedDifficulty([]);
    setReasoningData(defaultReasoningData());
  }, [isEditing]);

  const toggleType = (type: QuestionType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
    );
  };

  const toggleReasoning = (reasoning: keyof ReasoningDataState) => {
    setSelectedReasoning((prev) =>
      prev.includes(reasoning) ? prev.filter((item) => item !== reasoning) : [...prev, reasoning]
    );
  };

  const toggleDifficulty = (difficulty: 'easy' | 'medium' | 'hard') => {
    setSelectedDifficulty((prev) =>
      prev.includes(difficulty) ? prev.filter((item) => item !== difficulty) : [...prev, difficulty]
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

    // Normalize reasoning data - distribute evenly if multiple selected, or use first one
    const reasoningCount = selectedReasoning.length;
    const normalizedReasoningData: ReasoningDataState = {
      factual: {
        ...reasoningData.factual,
        total: selectedReasoning.includes('factual') ? (reasoningCount > 0 ? 100 / reasoningCount : 0) : 0
      },
      analytical: {
        ...reasoningData.analytical,
        total: selectedReasoning.includes('analytical') ? (reasoningCount > 0 ? 100 / reasoningCount : 0) : 0
      },
      application: {
        ...reasoningData.application,
        total: selectedReasoning.includes('application') ? (reasoningCount > 0 ? 100 / reasoningCount : 0) : 0
      }
    };

    // Use first selected reasoning for difficulty settings boundaries, or default to factual
    const primaryReasoning = selectedReasoning.length > 0 ? selectedReasoning[0] : 'factual';

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
        easyBoundary: normalizedReasoningData[primaryReasoning].easyBoundary,
        hardBoundary: normalizedReasoningData[primaryReasoning].hardBoundary
      }
    };

    await onSearchQuestions(
      {
        questionTypes: selectedTypes,
        primaryTopicIds,
        secondaryTopicIds,
        excludedTopicIds,
        difficulty: selectedDifficulty.length > 0 ? selectedDifficulty : null
      },
      payload,
      editingSection?.id
    );
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
            <Label htmlFor="section-name">
              Section Name <span className="text-red-500">*</span>
            </Label>
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
                {QUESTION_TYPE_LABELS[type]}
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
                  variant={selectedReasoning.includes(type) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleReasoning(type)}
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
                  variant={selectedDifficulty.includes(level) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleDifficulty(level)}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>
        {isSearching || !sectionName.trim() ? (
          <Tooltip
            content={isSearching ? 'Searching for questions...' : 'Section name is required'}
            multiline
          >
            <span className="inline-block w-full">
              <Button
                className="w-full"
                disabled={isSearching || !sectionName.trim()}
                onClick={handleSubmit}
              >
                {isSearching ? 'Searching...' : isEditing ? 'Update Search' : 'Search Questions'}
              </Button>
            </span>
          </Tooltip>
        ) : (
          <Button
            className="w-full"
            disabled={isSearching || !sectionName.trim()}
            onClick={handleSubmit}
          >
            {isSearching ? 'Searching...' : isEditing ? 'Update Search' : 'Search Questions'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
