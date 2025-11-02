import * as React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { DualRangeSlider } from '../ui/DualRangeSlider';
import { courseService } from '../../services/courseService';
import { Badge } from '../ui/badge';
import { ChevronDown } from 'lucide-react';
import { Tooltip } from '../ui/tooltip';

interface GenerateAssessmentModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate?: (params: AssessmentGenerationParams) => void;
  courseId: number;
  initialMode?: 'auto' | 'manual' | 'hybrid';
}

export interface AssessmentGenerationParams {
  numQuestions: number;
  primaryTopicIds: number[];
  secondaryTopicIds: number[];
  excludedTopicIds: number[];
  difficultyDistribution: {
    easy: number; // Factual
    medium: number; // Analysis
    hard: number; // Application
  };
  reasoningDistribution: {
    factual: number;
    analytical: number;
    application: number;
  };
  reasoningData: ReasoningDataState;
  mode: 'auto' | 'manual' | 'hybrid';
}

type Topic = { id: number; name: string };

export type ReasoningProfile = {
  total: number;
  easyBoundary: number;
  hardBoundary: number;
};

export type ReasoningDataState = {
  factual: ReasoningProfile;
  analytical: ReasoningProfile;
  application: ReasoningProfile;
};

export const GenerateAssessmentModal = ({ open, onClose, onGenerate, courseId, initialMode = 'auto' }: GenerateAssessmentModalProps) => {
  const [numQuestions, setNumQuestions] = React.useState<number>(10);
  const [availableTopics, setAvailableTopics] = React.useState<Topic[]>([]);
  const [primaryTopicIds, setPrimaryTopicIds] = React.useState<number[]>([]);
  const [secondaryTopicIds, setSecondaryTopicIds] = React.useState<number[]>([]);
  const [excludedTopicIds, setExcludedTopicIds] = React.useState<number[]>([]);
  const [mode, setMode] = React.useState<'auto' | 'manual' | 'hybrid'>(initialMode);
  const [openDropdown, setOpenDropdown] = React.useState<'primary' | 'secondary' | 'excluded' | null>(null);

  // Update mode when initialMode prop changes
  React.useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  // Matrix data model: each reasoning type has its own difficulty distribution
  const [reasoningData, setReasoningData] = React.useState<ReasoningDataState>({
    factual: {
      total: 40, // Total percentage for factual questions
      easyBoundary: 60, // Boundary between easy and medium
      hardBoundary: 90  // Boundary between medium and hard
    },
    analytical: {
      total: 35,
      easyBoundary: 50,
      hardBoundary: 80
    },
    application: {
      total: 25,
      easyBoundary: 40,
      hardBoundary: 70
    }
  });

  // Calculate difficulty distribution for each reasoning type
  const reasoningDistributions = React.useMemo(() => ({
    factual: {
      easy: reasoningData.factual.easyBoundary,
      medium: reasoningData.factual.hardBoundary - reasoningData.factual.easyBoundary,
      hard: 100 - reasoningData.factual.hardBoundary
    },
    analytical: {
      easy: reasoningData.analytical.easyBoundary,
      medium: reasoningData.analytical.hardBoundary - reasoningData.analytical.easyBoundary,
      hard: 100 - reasoningData.analytical.hardBoundary
    },
    application: {
      easy: reasoningData.application.easyBoundary,
      medium: reasoningData.application.hardBoundary - reasoningData.application.easyBoundary,
      hard: 100 - reasoningData.application.hardBoundary
    }
  }), [reasoningData]);

  // Calculate overall totals
  const overallTotals = React.useMemo(() => {
    const totalWeight = reasoningData.factual.total + reasoningData.analytical.total + reasoningData.application.total;
    
    if (totalWeight === 0) return { easy: 0, medium: 0, hard: 0, total: 0 };
    
    const easy = Math.round(
      (reasoningData.factual.total * reasoningDistributions.factual.easy +
       reasoningData.analytical.total * reasoningDistributions.analytical.easy +
       reasoningData.application.total * reasoningDistributions.application.easy) / totalWeight
    );
    
    const medium = Math.round(
      (reasoningData.factual.total * reasoningDistributions.factual.medium +
       reasoningData.analytical.total * reasoningDistributions.analytical.medium +
       reasoningData.application.total * reasoningDistributions.application.medium) / totalWeight
    );
    
    const hard = Math.round(
      (reasoningData.factual.total * reasoningDistributions.factual.hard +
       reasoningData.analytical.total * reasoningDistributions.analytical.hard +
       reasoningData.application.total * reasoningDistributions.application.hard) / totalWeight
    );
    
    return { easy, medium, hard, total: 100 };
  }, [reasoningData, reasoningDistributions]);

  // Auto-balance reasoning totals when one changes
  const updateReasoningTotal = (reasoningType: keyof typeof reasoningData, newTotal: number) => {
    const otherTypes = Object.keys(reasoningData).filter(key => key !== reasoningType) as Array<keyof typeof reasoningData>;
    const otherTotal = otherTypes.reduce((sum, type) => sum + reasoningData[type].total, 0);
    const remainingTotal = 100 - newTotal;
    
    if (remainingTotal < 0) return; // Prevent negative totals
    
    // Distribute remaining total proportionally among other types
    const otherTypesWithValues = otherTypes.filter(type => reasoningData[type].total > 0);
    
    if (otherTypesWithValues.length === 0) return;
    
    const scaleFactor = remainingTotal / otherTotal;
    
    setReasoningData(prev => {
      const newData = { ...prev };
      newData[reasoningType] = { ...newData[reasoningType], total: newTotal };
      
      otherTypes.forEach(type => {
        newData[type] = {
          ...newData[type],
          total: Math.round(newData[type].total * scaleFactor)
        };
      });
      
      return newData;
    });
  };

  React.useEffect(() => {
    if (!open) return;
    let isActive = true;
    (async () => {
      try {
        const topics = await courseService.getCourseTopics(courseId);
        if (!isActive) return;
        setAvailableTopics(topics);
        if (topics.length) {
          setPrimaryTopicIds((prev) => (prev.length ? prev : [topics[0].id]));
          setSecondaryTopicIds((prev) => prev.filter((id) => topics.some((t) => t.id === id)));
          setExcludedTopicIds((prev) => prev.filter((id) => topics.some((t) => t.id === id)));
        }
      } catch (e) {
        // ignore for now; could add toast later
      }
    })();
    return () => { isActive = false; };
  }, [open, courseId]);

  React.useEffect(() => {
    if (!open) {
      setOpenDropdown(null);
    }
  }, [open]);

  const topicNameById = React.useMemo(
    () => new Map(availableTopics.map((t) => [t.id, t.name])),
    [availableTopics]
  );

  const primaryDisabledSet = React.useMemo(
    () => new Set([...secondaryTopicIds, ...excludedTopicIds]),
    [secondaryTopicIds, excludedTopicIds]
  );
  const secondaryDisabledSet = React.useMemo(
    () => new Set([...primaryTopicIds, ...excludedTopicIds]),
    [primaryTopicIds, excludedTopicIds]
  );
  const excludedDisabledSet = React.useMemo(
    () => new Set([...primaryTopicIds, ...secondaryTopicIds]),
    [primaryTopicIds, secondaryTopicIds]
  );

  const getLabelsForIds = React.useCallback(
    (ids: number[]) =>
      ids
        .map((id) => topicNameById.get(id))
        .filter((value): value is string => Boolean(value)),
    [topicNameById]
  );

  const TopicMultiSelect = ({
    dropdownKey,
    label,
    description,
    placeholder,
    selectedIds,
    disabledSet,
    onToggle,
    showEmptyWarning
  }: {
    dropdownKey: 'primary' | 'secondary' | 'excluded';
    label: string;
    description?: string;
    placeholder: string;
    selectedIds: number[];
    disabledSet: Set<number>;
    onToggle: (id: number) => void;
    showEmptyWarning?: boolean;
  }) => {
    const selectedLabels = getLabelsForIds(selectedIds);
    const isOpen = openDropdown === dropdownKey;
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      if (!isOpen) return;
      const handleClick = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setOpenDropdown(null);
        }
      };
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen]);

    return (
      <div className="space-y-2" ref={containerRef}>
        <Label>{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <div className="relative">
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => setOpenDropdown(isOpen ? null : dropdownKey)}
          >
            <span className={selectedLabels.length ? 'truncate text-left' : 'text-muted-foreground'}>
              {selectedLabels.length ? selectedLabels.join(', ') : placeholder}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
          {isOpen && (
            <div className="absolute z-20 mt-2 w-full rounded-md border bg-background shadow-lg">
              <ScrollArea className="max-h-56">
                <div className="p-2 space-y-1">
                  {availableTopics.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-foreground">No topics yet for this course.</div>
                  ) : (
                    availableTopics.map((topic) => {
                      const isSelected = selectedIds.includes(topic.id);
                      const isDisabled = disabledSet.has(topic.id) && !isSelected;

                      return (
                        <button
                          type="button"
                          key={topic.id}
                          onClick={() => {
                            if (isDisabled) return;
                            onToggle(topic.id);
                          }}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-muted ${
                            isDisabled ? 'cursor-not-allowed text-muted-foreground/70' : 'cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="h-4 w-4"
                            disabled={isDisabled}
                          />
                          <span className="flex-1">{topic.name}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
        {selectedLabels.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedIds.map((id) => {
              const name = topicNameById.get(id);
              if (!name) return null;
              return (
                <Badge key={id} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              );
            })}
          </div>
        )}
        {showEmptyWarning && selectedIds.length === 0 && (
          <p className="text-xs text-amber-600">Select at least one topic.</p>
        )}
      </div>
    );
  };

  if (!open) return null;


  const togglePrimaryTopic = (id: number) => {
    setPrimaryTopicIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((value) => value !== id) : [...prev, id];
      if (!exists) {
        setSecondaryTopicIds((prevSecondary) => prevSecondary.filter((value) => value !== id));
        setExcludedTopicIds((prevExcluded) => prevExcluded.filter((value) => value !== id));
      }
      return next;
    });
  };

  const toggleSecondaryTopic = (id: number) => {
    setSecondaryTopicIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((value) => value !== id) : [...prev, id];
      if (!exists) {
        setPrimaryTopicIds((prevPrimary) => prevPrimary.filter((value) => value !== id));
        setExcludedTopicIds((prevExcluded) => prevExcluded.filter((value) => value !== id));
      }
      return next;
    });
  };

  const toggleExcludedTopic = (id: number) => {
    setExcludedTopicIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((value) => value !== id) : [...prev, id];
      if (!exists) {
        setPrimaryTopicIds((prevPrimary) => prevPrimary.filter((value) => value !== id));
        setSecondaryTopicIds((prevSecondary) => prevSecondary.filter((value) => value !== id));
      }
      return next;
    });
  };

  const canGenerate = primaryTopicIds.length > 0;

  const handleGenerate = () => {
    // Convert to the format expected by the API
    const difficultyDistribution = {
      easy: overallTotals.easy,
      medium: overallTotals.medium,
      hard: overallTotals.hard
    };

    const reasoningDistribution = {
      factual: reasoningData.factual.total,
      analytical: reasoningData.analytical.total,
      application: reasoningData.application.total
    };

    onGenerate?.({
      numQuestions,
      primaryTopicIds,
      secondaryTopicIds,
      excludedTopicIds,
      difficultyDistribution,
      reasoningDistribution,
      reasoningData,
      mode
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <Card className="relative flex w-full max-w-4xl max-h-[90vh] flex-col overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Generate Assessment</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="text-xs uppercase tracking-wide text-muted-foreground sm:hidden">Mode</span>
              <div className="flex items-center gap-2">
                <Tooltip content="AI builds your entire assessment." side="bottom">
                  <Button
                    variant={mode === 'auto' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMode('auto')}
                  >
                    🤖 Fully Automated
                  </Button>
                </Tooltip>
                <Tooltip content="AI suggests, you curate." side="bottom">
                  <Button
                    variant={mode === 'hybrid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMode('hybrid')}
                  >
                    🧩 Hybrid
                  </Button>
                </Tooltip>
                <Tooltip content="You pick everything." side="bottom">
                  <Button
                    variant={mode === 'manual' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMode('manual')}
                  >
                    ✋ Manual
                  </Button>
                </Tooltip>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-6 overflow-y-auto py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-2">
              <Label htmlFor="numQuestions">Number of questions</Label>
              <Input
                id="numQuestions"
                type="number"
                min={1}
                value={numQuestions}
                onChange={(e) => setNumQuestions(parseInt(e.target.value || '0', 10))}
              />
            </div>

            <div className="md:col-span-2 space-y-4">
              <TopicMultiSelect
                dropdownKey="primary"
                label="Primary topics"
                description="Choose the main focus areas for this assessment."
                placeholder="Select primary topics"
                selectedIds={primaryTopicIds}
                disabledSet={primaryDisabledSet}
                onToggle={togglePrimaryTopic}
                showEmptyWarning
              />

              <TopicMultiSelect
                dropdownKey="secondary"
                label="Secondary topics"
                description="Optional supporting topics. They can&apos;t overlap with primary or excluded topics."
                placeholder="Select secondary topics"
                selectedIds={secondaryTopicIds}
                disabledSet={secondaryDisabledSet}
                onToggle={toggleSecondaryTopic}
              />

              <TopicMultiSelect
                dropdownKey="excluded"
                label="Excluded topics"
                description="Topics to avoid in this assessment."
                placeholder="Select topics to exclude"
                selectedIds={excludedTopicIds}
                disabledSet={excludedDisabledSet}
                onToggle={toggleExcludedTopic}
              />
            </div>
          </div>

          {/* Reasoning × Difficulty Distribution Matrix */}
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold">Reasoning × Difficulty Distribution</h3>
              <p className="text-sm text-gray-500">Adjust the percentage of questions by reasoning type and difficulty level (total 100%)</p>
            </div>

            {/* Matrix Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-sm text-gray-700">Reasoning Type</th>
                    <th className="px-4 py-3 text-center font-medium text-sm text-gray-700">Easy</th>
                    <th className="px-4 py-3 text-center font-medium text-sm text-gray-700">Medium</th>
                    <th className="px-4 py-3 text-center font-medium text-sm text-gray-700">Hard</th>
                    <th className="px-4 py-3 text-center font-medium text-sm text-gray-700">Total (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {/* Factual Row */}
                  <tr>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded"></div>
                        <span className="font-medium text-sm">Factual</span>
                      </div>
                    </td>
                    <td colSpan={3} className="px-4 py-3">
                      <div className="space-y-1">
                        <DualRangeSlider
                          min={0}
                          max={100}
                          easyBoundary={reasoningData.factual.easyBoundary}
                          hardBoundary={reasoningData.factual.hardBoundary}
                          onChange={(easyBoundary, hardBoundary) => {
                            setReasoningData(prev => ({
                              ...prev,
                              factual: {
                                ...prev.factual,
                                easyBoundary,
                                hardBoundary
                              }
                            }));
                          }}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{reasoningDistributions.factual.easy}%</span>
                          <span>{reasoningDistributions.factual.medium}%</span>
                          <span>{reasoningDistributions.factual.hard}%</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={reasoningData.factual.total}
                        onChange={(e) => updateReasoningTotal('factual', parseInt(e.target.value || '0', 10))}
                        className="w-16 text-center text-sm"
                      />
                    </td>
                  </tr>

                  {/* Analytical Row */}
                  <tr>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                        <span className="font-medium text-sm">Analytical</span>
                      </div>
                    </td>
                    <td colSpan={3} className="px-4 py-3">
                      <div className="space-y-1">
                        <DualRangeSlider
                          min={0}
                          max={100}
                          easyBoundary={reasoningData.analytical.easyBoundary}
                          hardBoundary={reasoningData.analytical.hardBoundary}
                          onChange={(easyBoundary, hardBoundary) => {
                            setReasoningData(prev => ({
                              ...prev,
                              analytical: {
                                ...prev.analytical,
                                easyBoundary,
                                hardBoundary
                              }
                            }));
                          }}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{reasoningDistributions.analytical.easy}%</span>
                          <span>{reasoningDistributions.analytical.medium}%</span>
                          <span>{reasoningDistributions.analytical.hard}%</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={reasoningData.analytical.total}
                        onChange={(e) => updateReasoningTotal('analytical', parseInt(e.target.value || '0', 10))}
                        className="w-16 text-center text-sm"
                      />
                    </td>
                  </tr>

                  {/* Application Row */}
                  <tr>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded"></div>
                        <span className="font-medium text-sm">Application</span>
                      </div>
                    </td>
                    <td colSpan={3} className="px-4 py-3">
                      <div className="space-y-1">
                        <DualRangeSlider
                          min={0}
                          max={100}
                          easyBoundary={reasoningData.application.easyBoundary}
                          hardBoundary={reasoningData.application.hardBoundary}
                          onChange={(easyBoundary, hardBoundary) => {
                            setReasoningData(prev => ({
                              ...prev,
                              application: {
                                ...prev.application,
                                easyBoundary,
                                hardBoundary
                              }
                            }));
                          }}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{reasoningDistributions.application.easy}%</span>
                          <span>{reasoningDistributions.application.medium}%</span>
                          <span>{reasoningDistributions.application.hard}%</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={reasoningData.application.total}
                        onChange={(e) => updateReasoningTotal('application', parseInt(e.target.value || '0', 10))}
                        className="w-16 text-center text-sm"
                      />
                    </td>
                  </tr>

                  {/* Overall Total Row */}
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 font-medium text-sm text-gray-700">Overall Total</td>
                    <td className="px-4 py-3 text-center font-medium text-sm text-gray-700">{overallTotals.easy}%</td>
                    <td className="px-4 py-3 text-center font-medium text-sm text-gray-700">{overallTotals.medium}%</td>
                    <td className="px-4 py-3 text-center font-medium text-sm text-gray-700">{overallTotals.hard}%</td>
                    <td className="px-4 py-3 text-center font-medium text-sm text-gray-700">{overallTotals.total}%</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
          </CardContent>
        <CardFooter className="flex justify-end gap-3 border-t bg-muted/40 py-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={!canGenerate}>
            Generate
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default GenerateAssessmentModal;
