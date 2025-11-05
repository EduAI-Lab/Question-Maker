import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Edit, Download, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { Assessment, Course } from '../../types/assessment';
import { Question } from '../../types/question';
import GenerateAssessmentModal from './GenerateAssessmentModal';

interface AssessmentSectionProps {
  assessments: Assessment[];
  questions: Question[];
  onEditAssessment: (assessment: Assessment) => void;
  onExportAssessment: (assessment: Assessment) => void;
  onAddAssessment: () => void;
  onReorderQuestions: (assessmentId: number, questionIds: number[]) => void;
  selectedCourseId?: number | null;
}

export const AssessmentSection = ({
  assessments,
  questions,
  onEditAssessment,
  onExportAssessment,
  onAddAssessment,
  onReorderQuestions,
  selectedCourseId
}: AssessmentSectionProps) => {
  const [expandedAssessment, setExpandedAssessment] = useState<number | null>(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [pendingGenerateAction, setPendingGenerateAction] = useState<'create' | number | null>(null);

  const getAssessmentTypeColor = (type: string) => {
    switch (type) {
      case 'Lab': return 'bg-blue-100 text-blue-800';
      case 'Midterm': return 'bg-orange-100 text-orange-800';
      case 'Quiz': return 'bg-green-100 text-green-800';
      case 'Final': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getQuestionById = (questionId: number) => {
    return questions.find(q => q.id === questionId);
  };

  const handleQuestionReorder = (assessmentId: number, questionId: number, direction: 'up' | 'down') => {
    const assessment = assessments.find(a => a.id === assessmentId);
    if (!assessment) return;

    const questionIds = [...assessment.questions];
    const currentIndex = questionIds.indexOf(questionId);
    
    if (direction === 'up' && currentIndex > 0) {
      [questionIds[currentIndex], questionIds[currentIndex - 1]] = 
      [questionIds[currentIndex - 1], questionIds[currentIndex]];
    } else if (direction === 'down' && currentIndex < questionIds.length - 1) {
      [questionIds[currentIndex], questionIds[currentIndex + 1]] = 
      [questionIds[currentIndex + 1], questionIds[currentIndex]];
    }

    onReorderQuestions(assessmentId, questionIds);
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Assessments</h2>
          <p className="text-sm text-gray-600">Lab / Midterm / Quiz / Final</p>
        </div>
        <Button
          onClick={() => {
            if (selectedCourseId) {
              setPendingGenerateAction('create');
              setIsGenerateModalOpen(true);
            }
          }}
          className="flex items-center space-x-2"
          disabled={!selectedCourseId}
        >
          <Plus className="h-4 w-4" />
          <span>Add Assessment</span>
        </Button>
      </div>

      {/* Assessments List */}
      <div className="space-y-4">
        {assessments.map((assessment) => {
          const assessmentQuestions = assessment.questions
            .map(id => getQuestionById(id))
            .filter(Boolean) as Question[];

          return (
            <Card key={assessment.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CardTitle className="text-lg">{assessment.name}</CardTitle>
                    <Badge className={getAssessmentTypeColor(assessment.type)}>
                      {assessment.type}
                    </Badge>
                    <Badge variant="outline">
                      {assessmentQuestions.length} questions
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedAssessment(
                        expandedAssessment === assessment.id ? null : assessment.id
                      )}
                    >
                      {expandedAssessment === assessment.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditAssessment(assessment)}
                      className="flex items-center space-x-1"
                    >
                      <Edit className="h-4 w-4" />
                      <span>Edit</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onExportAssessment(assessment)}
                      className="flex items-center space-x-1"
                    >
                      <Download className="h-4 w-4" />
                      <span>Export</span>
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setPendingGenerateAction(assessment.id);
                        setIsGenerateModalOpen(true);
                      }}
                      className="flex items-center space-x-1"
                    >
                      <span>Variants</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {expandedAssessment === assessment.id && (
                <CardContent>
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Questions in this assessment:</h4>
                    
                    <ScrollArea className="h-64 w-full border rounded-lg">
                      <div className="p-4 space-y-2">
                        {assessmentQuestions.map((question, index) => (
                          <div
                            key={question.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center space-x-3">
                              <span className="text-sm font-medium text-gray-500">
                                Q{index + 1}
                              </span>
                              <p className="text-sm text-gray-900 line-clamp-1">
                                {question.description || question.content || 'No description'}
                              </p>
                              <Badge variant="outline" className="text-xs">
                                {question.difficulty ?? 'medium'}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleQuestionReorder(assessment.id, question.id, 'up')}
                                disabled={index === 0}
                                className="h-6 w-6 p-0"
                              >
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleQuestionReorder(assessment.id, question.id, 'down')}
                                disabled={index === assessmentQuestions.length - 1}
                                className="h-6 w-6 p-0"
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    {assessmentQuestions.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        No questions in this assessment yet.
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {assessments.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">No assessments created yet.</p>
          <Button
            onClick={() => {
              if (selectedCourseId) {
                setPendingGenerateAction('create');
                setIsGenerateModalOpen(true);
              }
            }}
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
            setIsGenerateModalOpen(false);
            setPendingGenerateAction(null);
          }}
          courseId={selectedCourseId}
          onGenerate={(params) => {
            console.log('Generate assessment params', params);
            onAddAssessment();
            setIsGenerateModalOpen(false);
            setPendingGenerateAction(null);
          }}
        />
      )}

      {typeof pendingGenerateAction === 'number' && (
        <GenerateAssessmentModal
          open={isGenerateModalOpen}
          onClose={() => {
            setIsGenerateModalOpen(false);
            setPendingGenerateAction(null);
          }}
          courseId={assessments.find(a => a.id === pendingGenerateAction)?.courseId || 0}
        />
      )}
    </div>
  );
};
