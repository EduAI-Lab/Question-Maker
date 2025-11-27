import * as React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tooltip } from '../ui/tooltip';
import { courseService } from '../../services/courseService';
import { TopicSelect } from './TopicSelect';
import { AssessmentGenerationParams, AssessmentType } from '../../types/question';

interface GenerateAssessmentModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate?: (params: AssessmentGenerationParams) => void;
  courseId: number;
}

type Topic = { id: number; name: string };

export const GenerateAssessmentModal = ({ open, onClose, onGenerate, courseId }: GenerateAssessmentModalProps) => {
  const [assessmentName, setAssessmentName] = React.useState('');
  const [assessmentType, setAssessmentType] = React.useState<AssessmentType>('Assignment');
  const [assessmentDescription, setAssessmentDescription] = React.useState('');
  const [assessmentSemester, setAssessmentSemester] = React.useState(() => {
    const now = new Date();
    return `Fall ${now.getFullYear()}`;
  });
  const [availableTopics, setAvailableTopics] = React.useState<Topic[]>([]);
  const [primaryTopicIds, setPrimaryTopicIds] = React.useState<number[]>([]);
  const [secondaryTopicIds, setSecondaryTopicIds] = React.useState<number[]>([]);
  const [excludedTopicIds, setExcludedTopicIds] = React.useState<number[]>([]);

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

  const canGenerate =
    courseId > 0 &&
    assessmentName.trim().length > 0 &&
    assessmentDescription.trim().length > 0 &&
    assessmentSemester.trim().length > 0 &&
    primaryTopicIds.length > 0;

  const getDisabledReason = (): string | null => {
    if (!canGenerate) {
      const reasons: string[] = [];
      if (courseId <= 0) reasons.push('course');
      if (assessmentName.trim().length === 0) reasons.push('name');
      if (assessmentDescription.trim().length === 0) reasons.push('description');
      if (assessmentSemester.trim().length === 0) reasons.push('semester');
      if (primaryTopicIds.length === 0) reasons.push('at least one primary topic');
      
      if (reasons.length > 0) {
        return `Missing required fields: ${reasons.join(', ')}`;
      }
    }
    return null;
  };

  const disabledReason = getDisabledReason();

  const handleGenerate = () => {
    // Provide default values for removed difficulty matrix fields
    const difficultyDistribution = {
      easy: 0,
      medium: 0,
      hard: 0
    };

    const reasoningDistribution = {
      factual: 0,
      analytical: 0,
      application: 0
    };

    const reasoningData = {
      factual: {
        total: 0,
        easyBoundary: 0,
        hardBoundary: 0
      },
      analytical: {
        total: 0,
        easyBoundary: 0,
        hardBoundary: 0
      },
      application: {
        total: 0,
        easyBoundary: 0,
        hardBoundary: 0
      }
    };

    onGenerate?.({
      courseId,
      name: assessmentName.trim(),
      type: assessmentType,
      description: assessmentDescription.trim(),
      semester: assessmentSemester.trim(),
      primaryTopicIds,
      secondaryTopicIds,
      excludedTopicIds,
      difficultyDistribution,
      reasoningDistribution,
      reasoningData
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <Card className="relative flex w-full max-w-4xl max-h-[90vh] flex-col overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle>Create Assessment Blueprint</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 space-y-6 overflow-y-auto py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="assessmentName">Assessment name</Label>
              <Input
                id="assessmentName"
                value={assessmentName}
                onChange={(e) => setAssessmentName(e.target.value)}
                placeholder="e.g. Midterm 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assessmentType">Assessment type</Label>
              <Select value={assessmentType} onValueChange={(value) => setAssessmentType(value as AssessmentType)}>
                <SelectTrigger id="assessmentType">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {(['Assignment', 'Lab', 'Quiz', 'Midterm', 'Final'] as AssessmentType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assessmentSemester">Semester</Label>
              <Input
                id="assessmentSemester"
                value={assessmentSemester}
                onChange={(e) => setAssessmentSemester(e.target.value)}
                placeholder="e.g. Fall 2024"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="assessmentDescription">Description</Label>
              <Textarea
                id="assessmentDescription"
                value={assessmentDescription}
                onChange={(e) => setAssessmentDescription(e.target.value)}
                placeholder="What should this assessment cover?"
                rows={3}
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
          </CardContent>
        <CardFooter className="flex justify-end gap-3 border-t bg-muted/40 py-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {disabledReason ? (
            <Tooltip content={disabledReason} multiline>
              <span className="inline-block">
                <Button onClick={handleGenerate} disabled={!canGenerate}>
                  Save Blueprint
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Button onClick={handleGenerate} disabled={!canGenerate}>
              Save Blueprint
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default GenerateAssessmentModal;
