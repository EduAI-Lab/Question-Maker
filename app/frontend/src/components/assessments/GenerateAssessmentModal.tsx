import * as React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { courseService } from '../../services/courseService';

interface GenerateAssessmentModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate?: (params: AssessmentGenerationParams) => void;
  courseId: number;
}

export interface AssessmentGenerationParams {
  numQuestions: number;
  primaryTopicId?: number;
  secondaryTopicIds: number[];
  difficultyDistribution: {
    easy: number; // Factual
    medium: number; // Analysis
    hard: number; // Application
  };
  autoContextStrength: number; // 0-100
  mode: 'auto' | 'manual' | 'hybrid';
}

type Topic = { id: number; name: string };

export const GenerateAssessmentModal = ({ open, onClose, onGenerate, courseId }: GenerateAssessmentModalProps) => {
  const [numQuestions, setNumQuestions] = React.useState<number>(10);
  const [availableTopics, setAvailableTopics] = React.useState<Topic[]>([]);
  const [primaryTopicId, setPrimaryTopicId] = React.useState<number | undefined>(undefined);
  const [secondaryTopicIds, setSecondaryTopicIds] = React.useState<number[]>([]);
  const [autoContextStrength, setAutoContextStrength] = React.useState<number>(60);
  const [mode, setMode] = React.useState<'auto' | 'manual' | 'hybrid'>('auto');
  // Dual-range boundaries representing percentages for three segments
  // factual = [0, factualBoundary), analysis = [factualBoundary, analysisBoundary), application = [analysisBoundary, 100]
  const [factualBoundary, setFactualBoundary] = React.useState<number>(30);
  const [analysisBoundary, setAnalysisBoundary] = React.useState<number>(70);

  const distribution = React.useMemo(() => {
    const left = Math.max(0, Math.min(factualBoundary, 100));
    const right = Math.max(left, Math.min(analysisBoundary, 100));
    return {
      easy: Math.round(left),
      medium: Math.round(right - left),
      hard: Math.round(100 - right)
    };
  }, [factualBoundary, analysisBoundary]);

  React.useEffect(() => {
    if (!open) return;
    let isActive = true;
    (async () => {
      try {
        const topics = await courseService.getCourseTopics(courseId);
        if (!isActive) return;
        setAvailableTopics(topics);
        if (topics.length && primaryTopicId === undefined) {
          setPrimaryTopicId(topics[0].id);
        }
      } catch (e) {
        // ignore for now; could add toast later
      }
    })();
    return () => { isActive = false; };
  }, [open, courseId]);

  if (!open) return null;

  const toggleSecondaryTopic = (id: number) => {
    setSecondaryTopicIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleGenerate = () => {
    onGenerate?.({
      numQuestions,
      primaryTopicId,
      secondaryTopicIds,
      difficultyDistribution: distribution,
      autoContextStrength,
      mode
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <Card className="relative w-full max-w-3xl">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle>Generate Assessment</CardTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Auto context</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={autoContextStrength}
                  onChange={(e) => setAutoContextStrength(parseInt(e.target.value, 10))}
                  className="w-32"
                />
                <span className="w-8 text-right text-sm text-gray-700">{autoContextStrength}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setMode('manual')}>Manual</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 py-6">
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
              <div className="space-y-2">
                <Label>Primary topic</Label>
                <Select value={primaryTopicId?.toString() ?? ''} onValueChange={(v) => setPrimaryTopicId(parseInt(v, 10))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a primary topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTopics.map((t) => (
                      <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Secondary topics</Label>
                <ScrollArea className="h-32 w-full rounded-md border">
                  <div className="p-2 space-y-1">
                    {availableTopics.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={secondaryTopicIds.includes(t.id)}
                          onChange={() => toggleSecondaryTopic(t.id)}
                        />
                        <span>{t.name}</span>
                      </label>
                    ))}
                    {availableTopics.length === 0 && (
                      <div className="text-sm text-gray-500">No topics yet for this course.</div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Reasoning difficulty</h3>
              <span className="text-sm text-gray-500">Factual / Analysis / Application</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-700">
                <span>Factual (easy): {distribution.easy}%</span>
                <span>Analysis (medium): {distribution.medium}%</span>
                <span>Application (hard): {distribution.hard}%</span>
              </div>
              <div className="relative py-3">
                <div className="h-2 rounded bg-gray-200" />
                <div className="absolute inset-x-0 top-1.5 h-2 pointer-events-none">
                  <div className="h-2 rounded-l bg-blue-300" style={{ width: `${Math.max(0, Math.min(factualBoundary, 100))}%` }} />
                  <div className="h-2 bg-yellow-300" style={{ width: `${Math.max(0, Math.min(analysisBoundary - factualBoundary, 100))}%`, marginLeft: `${Math.max(0, Math.min(factualBoundary, 100))}%` }} />
                  <div className="h-2 rounded-r bg-green-300" style={{ width: `${Math.max(0, Math.min(100 - analysisBoundary, 100))}%`, marginLeft: `${Math.max(0, Math.min(analysisBoundary, 100))}%` }} />
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={factualBoundary}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setFactualBoundary(Math.min(v, analysisBoundary));
                  }}
                  className="absolute inset-x-0 -top-1 h-6 w-full opacity-0 cursor-pointer"
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={analysisBoundary}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setAnalysisBoundary(Math.max(v, factualBoundary));
                  }}
                  className="absolute inset-x-0 -top-1 h-6 w-full opacity-0 cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant={mode === 'auto' ? 'default' : 'outline'} size="sm" onClick={() => setMode('auto')}>Fully Automated</Button>
                <Button variant={mode === 'hybrid' ? 'default' : 'outline'} size="sm" onClick={() => setMode('hybrid')}>Hybrid</Button>
                <Button variant={mode === 'manual' ? 'default' : 'outline'} size="sm" onClick={() => setMode('manual')}>Manual</Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleGenerate}>Generate</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GenerateAssessmentModal;



