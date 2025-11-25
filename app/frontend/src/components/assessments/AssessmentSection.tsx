import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Plus, ChevronUp, ChevronDown, Eye, Upload, AlertTriangle } from 'lucide-react';
import { Assessment, AssessmentGenerationParams } from '../../types/question';
import GenerateAssessmentModal from './GenerateAssessmentModal';

interface AssessmentSectionProps {
  assessments: Assessment[];
  onAddAssessment: (params: AssessmentGenerationParams) => Promise<void> | void;
  selectedCourseId?: number | null;
  isLoading?: boolean;
  loadError?: string | null;
  onExportToCanvas?: (assessmentId: number, assessmentName: string) => void;
}

type QuestionEntry = {
  id: number;
  description: string | null;
  difficulty: string;
  order: number;
};

const getAssessmentTypeColor = (type: string) => {
  switch (type) {
    case 'Lab':
      return 'bg-blue-100 text-blue-800';
    case 'Midterm':
      return 'bg-orange-100 text-orange-800';
    case 'Quiz':
      return 'bg-green-100 text-green-800';
    case 'Final':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const buildQuestionEntries = (assessment: Assessment): QuestionEntry[] => {
  if (!assessment.variants || assessment.variants.length === 0) {
    return [];
  }

  const map = new Map<number, QuestionEntry>();

  assessment.variants.forEach((variant) => {
    const metadata = variant.questionMetadata;
    if (!metadata) {
      return;
    }

    const orderValue = metadata.questionOrder?.[assessment.id];
    const order = typeof orderValue === 'number' ? orderValue : Number.MAX_SAFE_INTEGER;

    const existing = map.get(metadata.id);
    if (!existing || order < existing.order) {
      map.set(metadata.id, {
        id: metadata.id,
        description: metadata.description ?? null,
        difficulty: variant.difficulty ?? 'medium',
        order
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => a.order - b.order);
};

const hasDraftQuestions = (assessment: Assessment): boolean => {
  if (!assessment.sections || assessment.sections.length === 0) {
    return false;
  }
  return assessment.sections.some((section) =>
    section.sectionVariants?.some(
      (link) => link.variant?.questionMetadata?.isDraft === true
    )
  );
};

export const AssessmentSection = ({
  assessments,
  onAddAssessment,
  selectedCourseId,
  isLoading = false,
  loadError,
  onExportToCanvas
}: AssessmentSectionProps) => {
  const navigate = useNavigate();
  const [expandedAssessment, setExpandedAssessment] = useState<number | null>(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [pendingGenerateAction, setPendingGenerateAction] = useState<'create' | number | null>(null);
  const [isSavingBlueprint, setIsSavingBlueprint] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasAssessments = assessments.length > 0;

  const handleOpenCreateModal = () => {
    if (!selectedCourseId) return;
    setPendingGenerateAction('create');
    setSaveError(null);
    setIsGenerateModalOpen(true);
  };

  const handleBlueprintSave = async (params: AssessmentGenerationParams) => {
    try {
      setIsSavingBlueprint(true);
      setSaveError(null);
      await onAddAssessment(params);
      setIsGenerateModalOpen(false);
      setPendingGenerateAction(null);
    } catch (error: any) {
      setSaveError(error?.response?.data?.error || 'Failed to save assessment blueprint');
    } finally {
      setIsSavingBlueprint(false);
    }
  };

  const headerDescription = useMemo(() => {
    if (isLoading) {
      return 'Loading assessments...';
    }
    if (!selectedCourseId) {
      return 'Select a course to manage its assessments.';
    }
    return 'Lab / Midterm / Quiz / Final';
  }, [isLoading, selectedCourseId]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Assessments</h2>
          <p className="text-sm text-gray-600">{headerDescription}</p>
          {loadError && (
            <p className="text-sm text-red-600 mt-1">{loadError}</p>
          )}
        </div>
        <Button
          onClick={handleOpenCreateModal}
          className="flex items-center space-x-2"
          disabled={!selectedCourseId || isSavingBlueprint}
        >
          <Plus className="h-4 w-4" />
          <span>{isSavingBlueprint ? 'Saving...' : 'Add Assessment'}</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Loading assessments...
        </div>
      ) : (
        <div className="space-y-4">
          {assessments.map((assessment) => {
            const assessmentQuestions = buildQuestionEntries(assessment);
            const blueprint = assessment.blueprintConfig;
            const difficulty = blueprint?.difficultyDistribution;
            const primaryCount = blueprint?.primaryTopicIds?.length ?? 0;
            const secondaryCount = blueprint?.secondaryTopicIds?.length ?? 0;
            const hasDrafts = hasDraftQuestions(assessment);

            return (
              <Card key={assessment.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <CardTitle className="text-lg">{assessment.name}</CardTitle>
                      <Badge className={getAssessmentTypeColor(assessment.type)}>
                        {assessment.type}
                      </Badge>
                      <Badge variant="outline">{assessment.semester}</Badge>
                      <Badge variant="outline">
                        {assessmentQuestions.length} questions
                      </Badge>
                      {hasDrafts && (
                        <Badge variant="default" className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Contains Draft questions
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/assessments/${assessment.id}`)}
                        className="flex items-center space-x-1"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View</span>
                      </Button>
                      {onExportToCanvas && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onExportToCanvas(assessment.id, assessment.name)}
                          disabled={hasDrafts}
                          title={hasDrafts ? 'Cannot export: Assessment contains draft questions. Please review all draft questions before exporting.' : 'Export assessment to Canvas'}
                          className="flex items-center space-x-1 bg-black text-white hover:bg-gray-800 border-black disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Upload className="h-4 w-4" />
                          <span>Export to Canvas</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedAssessment(
                            expandedAssessment === assessment.id ? null : assessment.id
                          )
                        }
                      >
                        {expandedAssessment === assessment.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  {(assessment.description || blueprint) && (
                    <div className="mt-3 space-y-2 text-sm text-gray-600">
                      {assessment.description && (
                        <p>{assessment.description}</p>
                      )}
                      {blueprint && (
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>Primary topics: {primaryCount}</span>
                          <span>Secondary topics: {secondaryCount}</span>
                          {difficulty && (
                            <span>
                              Difficulty mix: {difficulty.easy}% / {difficulty.medium}% / {difficulty.hard}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardHeader>

                {expandedAssessment === assessment.id && (
                  <CardContent>
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900">Questions in this assessment</h4>
                      <ScrollArea className="h-64 w-full border rounded-lg">
                        <div className="p-4 space-y-2">
                          {assessmentQuestions.length === 0 ? (
                            <div className="text-center text-sm text-muted-foreground py-6">
                              No questions linked yet. Generate or add variants to populate this list.
                            </div>
                          ) : (
                            assessmentQuestions.map((question, index) => (
                              <div
                                key={question.id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                              >
                                <div className="flex items-center space-x-3">
                                  <span className="text-sm font-medium text-gray-500">
                                    Q{index + 1}
                                  </span>
                                  <p className="text-sm text-gray-900 line-clamp-1">
                                    {question.description || 'No description'}
                                  </p>
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {question.difficulty}
                                  </Badge>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {!isLoading && !hasAssessments && (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">No assessments created yet.</p>
          <Button
            onClick={handleOpenCreateModal}
            className="flex items-center space-x-2"
            disabled={!selectedCourseId}
          >
            <Plus className="h-4 w-4" />
            <span>Create Your First Assessment</span>
          </Button>
        </div>
      )}

      {pendingGenerateAction === 'create' && selectedCourseId && (
        <GenerateAssessmentModal
          open={isGenerateModalOpen}
          onClose={() => {
            if (isSavingBlueprint) return;
            setIsGenerateModalOpen(false);
            setPendingGenerateAction(null);
          }}
          onGenerate={handleBlueprintSave}
          courseId={selectedCourseId}
        />
      )}

      {typeof pendingGenerateAction === 'number' && (
        <GenerateAssessmentModal
          open={isGenerateModalOpen}
          onClose={() => {
            setIsGenerateModalOpen(false);
            setPendingGenerateAction(null);
          }}
          courseId={
            assessments.find((a) => a.id === pendingGenerateAction)?.courseId || 0
          }
        />
      )}

      {saveError && (
        <p className="text-sm text-red-600 text-center">{saveError}</p>
      )}
    </div>
  );
};

export default AssessmentSection;
