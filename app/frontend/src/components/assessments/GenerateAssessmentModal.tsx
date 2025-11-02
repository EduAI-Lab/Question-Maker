import * as React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { DualRangeSlider } from '../ui/DualRangeSlider';
import { courseService } from '../../services/courseService';
import { Tooltip } from '../ui/tooltip';
import { TopicSelect } from './TopicSelect';

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

  if (!open) return null;

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
          </div>

          {/* Topic Selection Section */}
          <div className="mt-6">
            <TopicSelect
              availableTopics={availableTopics}
              primaryTopicIds={primaryTopicIds}
              secondaryTopicIds={secondaryTopicIds}
              excludedTopicIds={excludedTopicIds}
              onPrimaryChange={setPrimaryTopicIds}
              onSecondaryChange={setSecondaryTopicIds}
              onExcludedChange={setExcludedTopicIds}
            />
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
