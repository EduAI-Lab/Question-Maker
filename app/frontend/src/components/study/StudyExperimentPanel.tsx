/**
 * Honors study: mark reference exam, preview blueprint snapshot, assemble variant exams, run metrics.
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { useToast } from '../ui/use-toast';
import studyService, { type BlueprintSnapshot } from '../../services/studyService';

type BlueprintConfig = { studyRole?: string; referenceAssessmentId?: number } | null | undefined;

interface StudyExperimentPanelProps {
  assessmentId: number;
  courseId: number;
  assessmentName: string;
  blueprintConfig?: BlueprintConfig;
  onAssessmentRefresh: () => Promise<void>;
}

export const StudyExperimentPanel = ({
  assessmentId,
  courseId,
  assessmentName,
  blueprintConfig,
  onAssessmentRefresh
}: StudyExperimentPanelProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = React.useState<BlueprintSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = React.useState(false);
  const [assembling, setAssembling] = React.useState(false);
  const [metricsLoading, setMetricsLoading] = React.useState(false);
  const [lastAssembledIds, setLastAssembledIds] = React.useState<number[]>([]);
  const [metricsSummary, setMetricsSummary] = React.useState<string | null>(null);

  const studyRole = blueprintConfig?.studyRole ?? null;

  const handleMarkReference = async () => {
    try {
      await studyService.setStudyRole(assessmentId, 'reference_baseline');
      await onAssessmentRefresh();
      toast({ title: 'Study role updated', description: 'This assessment is marked as the reference baseline.' });
    } catch (e: unknown) {
      toast({
        title: 'Failed to update',
        description: (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleClearRole = async () => {
    try {
      await studyService.setStudyRole(assessmentId, null);
      await onAssessmentRefresh();
      toast({ title: 'Study role cleared' });
    } catch (e: unknown) {
      toast({
        title: 'Failed to update',
        description: (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleLoadSnapshot = async () => {
    try {
      setLoadingSnapshot(true);
      const data = await studyService.getBlueprintSnapshot(assessmentId);
      setSnapshot(data);
    } catch (e: unknown) {
      toast({
        title: 'Snapshot failed',
        description: (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoadingSnapshot(false);
    }
  };

  const handleAssemble = async () => {
    try {
      setAssembling(true);
      setMetricsSummary(null);
      const result = await studyService.assembleEquivalentExams({
        referenceAssessmentId: assessmentId,
        courseId,
        namePrefix: assessmentName,
        examLabels: ['Exam A', 'Exam B', 'Exam C'],
        includeDrafts: false
      });
      const ids = result.createdAssessments.map((a) => a.id);
      setLastAssembledIds(ids);
      toast({
        title: 'Variant exams created',
        description: `${result.examCount} exams in ${result.assemblyTimeMs} ms. ${result.warnings.length ? `${result.warnings.length} warning(s) — see panel.` : ''}`
      });
      if (result.warnings.length > 0) {
        console.warn('Study assembly warnings', result.warnings);
      }
    } catch (e: unknown) {
      toast({
        title: 'Assembly failed',
        description: (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Need ≥2 non-draft variants per slot where possible.',
        variant: 'destructive'
      });
    } finally {
      setAssembling(false);
    }
  };

  const handleMetrics = async () => {
    const ids = [assessmentId, ...lastAssembledIds].filter((id, i, arr) => arr.indexOf(id) === i);
    if (ids.length < 2) {
      toast({
        title: 'Need more exams',
        description: 'Assemble variant exams first, or add other assessment IDs in the study API.',
        variant: 'destructive'
      });
      return;
    }
    try {
      setMetricsLoading(true);
      const data = await studyService.computeMetrics(ids, assessmentId);
      const w = data.workflow;
      setMetricsSummary(
        `Pairwise metrics computed. Cross-exam variant reuse: ${w.variantsAppearingInMultipleExams} (IDs: ${w.reusedVariantIds.join(', ') || 'none'}). ` +
          `AI variant placements: ${w.aiGeneratedVariantPlacements} / ${w.totalQuestionPlacements}.`
      );
      toast({ title: 'Metrics ready', description: 'Summary shown below; full JSON in devtools network response.' });
    } catch (e: unknown) {
      toast({
        title: 'Metrics failed',
        description: (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Please try again.',
        variant: 'destructive'
      });
    } finally {
      setMetricsLoading(false);
    }
  };

  return (
    <Card className="border-dashed border-amber-200/80 bg-amber-50/40">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <FlaskConical className="h-5 w-5 text-amber-800" aria-hidden />
          <CardTitle className="text-base text-amber-950">Study experiment</CardTitle>
          {studyRole === 'reference_baseline' && (
            <Badge className="bg-amber-700 text-white hover:bg-amber-700">Reference baseline</Badge>
          )}
          {studyRole === 'generated_variant' && (
            <Badge variant="secondary">Generated variant</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Mark an imported exam as ground truth, assemble three parallel exams from the bank, then compare structural similarity.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={handleMarkReference}>
            Mark as reference baseline
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleClearRole}>
            Clear study role
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleLoadSnapshot} disabled={loadingSnapshot}>
            {loadingSnapshot ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading…
              </>
            ) : (
              'Load blueprint snapshot'
            )}
          </Button>
        </div>

        {snapshot && (
          <div className="rounded-md border border-amber-200 bg-white p-3 text-sm">
            <p className="font-medium text-gray-900">{snapshot.slotCount} slots</p>
            <p className="text-muted-foreground">
              Difficulty: {JSON.stringify(snapshot.aggregates.difficultyCounts)} · Types:{' '}
              {JSON.stringify(snapshot.aggregates.typeCounts)}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-amber-200/60 pt-3">
          <Button type="button" size="sm" onClick={handleAssemble} disabled={assembling}>
            {assembling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assembling…
              </>
            ) : (
              'Assemble Exam A, B & C'
            )}
          </Button>
          {lastAssembledIds.length > 0 && (
            <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
              Created:
              {lastAssembledIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="underline-offset-2 hover:underline"
                  onClick={() => navigate(`/assessments/${id}/builder`)}
                >
                  #{id}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={handleMetrics} disabled={metricsLoading}>
            {metricsLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Computing…
              </>
            ) : (
              'Compare metrics (reference + last assembled)'
            )}
          </Button>
        </div>
        {metricsSummary && <p className="text-sm text-gray-700">{metricsSummary}</p>}
      </CardContent>
    </Card>
  );
};
