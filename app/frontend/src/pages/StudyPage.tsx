/**
 * Study workflow: (1) baseline reference exam → (2) generate variants from those questions →
 * (3) assemble parallel exams matching baseline structure → (4) similarity metrics.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList, FlaskConical, Loader2, Sparkles, Upload } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { useToast } from '../components/ui/use-toast';
import { useCourses } from '../hooks/useCourses';
import { courseService } from '../services/courseService';
import assessmentService from '../services/assessmentService';
import studyService from '../services/studyService';
import { QuestionUploadDialog } from '../components/question-bank/QuestionUploadDialog';
import { CanvasImportDialog } from '../components/canvas/CanvasImportDialog';
import type { Assessment, Course, Question } from '../types/question';
import type { Topic } from '../types/topic';

/** Unique question_metadata ids in section order (first occurrence per base question). */
function collectQuestionMetadataIdsFromAssessment(assessment: Assessment): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  const sections = [...(assessment.sections ?? [])].sort((a, b) => a.position - b.position);
  for (const s of sections) {
    const links = [...(s.sectionVariants ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
    for (const link of links) {
      const mid = link.variant?.questionMetadataId ?? link.variant?.questionMetadata?.id;
      if (typeof mid === 'number' && Number.isFinite(mid) && !seen.has(mid)) {
        seen.add(mid);
        out.push(mid);
      }
    }
  }
  return out;
}

async function loadAssessmentDetail(assessmentId: number): Promise<Assessment> {
  const a = await assessmentService.getAssessment(assessmentId);
  const hasVariants = a.sections?.some((s) => (s.sectionVariants?.length ?? 0) > 0);
  if (hasVariants) return a;
  const sections = await assessmentService.getAssessmentSections(assessmentId);
  return { ...a, sections };
}

export function StudyPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { courses, isLoading: coursesLoading, fetchCourses } = useCourses();

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [baselineAssessmentId, setBaselineAssessmentId] = useState<string>('');
  const [examUploadOpen, setExamUploadOpen] = useState(false);
  const [canvasImportOpen, setCanvasImportOpen] = useState(false);
  const [generatingVariants, setGeneratingVariants] = useState(false);
  const [assembling, setAssembling] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [lastAssembled, setLastAssembled] = useState<Array<{ id: number; name: string }>>([]);
  const [metricsData, setMetricsData] = useState<Awaited<ReturnType<typeof studyService.computeMetrics>> | null>(
    null
  );

  useEffect(() => {
    void fetchCourses();
  }, [fetchCourses]);

  const loadTopics = useCallback(async (courseId: number) => {
    const t = await courseService.getCourseTopics(courseId);
    setTopics(t);
    return t;
  }, []);

  const loadAssessments = useCallback(async (courseId: number) => {
    const list = await assessmentService.getAssessments({ courseId });
    setAssessments(list);
    return list;
  }, []);

  useEffect(() => {
    if (!selectedCourse?.id) {
      setTopics([]);
      setAssessments([]);
      setBaselineAssessmentId('');
      return;
    }
    void loadTopics(selectedCourse.id);
    void loadAssessments(selectedCourse.id);
  }, [selectedCourse?.id, loadTopics, loadAssessments]);

  const baselineAssessment = useMemo(
    () => assessments.find((a) => a.id.toString() === baselineAssessmentId),
    [assessments, baselineAssessmentId]
  );

  const handleExamQuestionsSaved = async (_questions: Question[], meta?: { assessmentId: number | null }) => {
    setExamUploadOpen(false);
    if (selectedCourse?.id) await loadAssessments(selectedCourse.id);
    if (meta?.assessmentId) {
      setBaselineAssessmentId(String(meta.assessmentId));
    }
    toast({
      title: 'Baseline exam saved',
      description: meta?.assessmentId
        ? 'Selected as the current baseline. Mark it as reference, then generate variants.'
        : 'Select the assessment below.'
    });
  };

  const handleCanvasImport = async (result: { assessmentId: number; assessmentName: string }) => {
    setCanvasImportOpen(false);
    setBaselineAssessmentId(String(result.assessmentId));
    if (selectedCourse?.id) await loadAssessments(selectedCourse.id);
    toast({
      title: 'Imported from Canvas',
      description: `"${result.assessmentName}" — mark as reference, then generate variants.`
    });
  };

  const markBaseline = async () => {
    const id = Number(baselineAssessmentId);
    if (!id) {
      toast({ variant: 'destructive', title: 'Select a baseline exam first' });
      return;
    }
    try {
      await studyService.setStudyRole(id, 'reference_baseline');
      await loadAssessments(selectedCourse!.id);
      toast({ title: 'Marked as reference baseline' });
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Failed',
        description: (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Try again.'
      });
    }
  };

  const generateVariantsFromBaseline = async () => {
    const refId = Number(baselineAssessmentId);
    if (!selectedCourse?.id || !refId) {
      toast({ variant: 'destructive', title: 'Select a course and baseline exam first' });
      return;
    }
    setGeneratingVariants(true);
    setMetricsData(null);
    setLastAssembled([]);
    try {
      const detail = await loadAssessmentDetail(refId);
      const questionIds = collectQuestionMetadataIdsFromAssessment(detail);
      if (questionIds.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No questions found',
          description: 'Add questions to the baseline exam (sections with variants), then try again.'
        });
        return;
      }
      const result = await studyService.generateBankVariants({
        courseId: selectedCourse.id,
        questionIds,
        variantsToAdd: 2
      });
      const failed = result.errors?.length ?? 0;
      toast({
        title: 'Variants generated',
        description: `Processed ${questionIds.length} base question(s). ${failed ? `${failed} step(s) logged errors (see console).` : 'Ready to assemble.'}`
      });
      if (result.errors?.length) {
        console.warn('Study generateBankVariants errors', result.errors);
      }
      void loadAssessments(selectedCourse.id);
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Variant generation failed',
        description: (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Check EduAI configuration.',
        duration: Number.POSITIVE_INFINITY
      });
    } finally {
      setGeneratingVariants(false);
    }
  };

  const assembleStructureMatchedExams = async () => {
    const refId = Number(baselineAssessmentId);
    if (!selectedCourse?.id || !refId) {
      toast({ variant: 'destructive', title: 'Select a course and baseline exam' });
      return;
    }
    setAssembling(true);
    setMetricsData(null);
    try {
      const result = await studyService.assembleEquivalentExams({
        referenceAssessmentId: refId,
        courseId: selectedCourse.id,
        examLabels: ['Exam A', 'Exam B', 'Exam C'],
        namePrefix: baselineAssessment?.name ?? 'Study exam',
        includeDrafts: true
      });
      setLastAssembled(result.createdAssessments.map((a) => ({ id: a.id, name: a.name })));
      toast({
        title: 'Parallel exams assembled',
        description: `${result.examCount} exams in ${result.assemblyTimeMs} ms — same structure as baseline (different variants per slot).`
      });
      if (result.warnings?.length) {
        console.warn('Assembly warnings', result.warnings);
      }
      await loadAssessments(selectedCourse.id);
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Assembly failed',
        description: (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Need enough distinct variants per baseline slot (≥3 non-draft per base for three exams).',
        duration: Number.POSITIVE_INFINITY
      });
    } finally {
      setAssembling(false);
    }
  };

  const runMetrics = async () => {
    const refId = Number(baselineAssessmentId);
    const ids = [refId, ...lastAssembled.map((a) => a.id)].filter((x) => Number.isFinite(x) && x > 0);
    const unique = [...new Set(ids)];
    if (unique.length < 2) {
      toast({ variant: 'destructive', title: 'Assemble exam variants first' });
      return;
    }
    setMetricsLoading(true);
    try {
      const data = await studyService.computeMetrics(unique, refId);
      setMetricsData(data);
      toast({ title: 'Similarity metrics computed' });
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Metrics failed',
        description: (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Try again.'
      });
    } finally {
      setMetricsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="gap-1.5 text-muted-foreground">
              <Link to="/home">
                <ArrowLeft className="h-4 w-4" />
                Home
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-indigo-600" />
              <h1 className="text-lg font-semibold tracking-tight text-slate-900">Study</h1>
            </div>
          </div>
          <div className="flex min-w-[220px] flex-1 items-center justify-end gap-2 sm:max-w-md">
            <Select
              value={selectedCourse?.id?.toString() ?? ''}
              onValueChange={(v) => {
                const c = courses.find((x) => x.id.toString() === v);
                if (c) setSelectedCourse(c);
              }}
              disabled={coursesLoading || courses.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={coursesLoading ? 'Loading courses…' : 'Select course'} />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.code || '—'} · {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
        <p className="text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Order:</strong> upload the baseline reference exam first, generate
          variants for those questions, assemble parallel exams that mirror the baseline structure, then run the similarity
          checker.
        </p>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">1 · Baseline reference exam</h2>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4" />
                Upload or import the reference exam
              </CardTitle>
              <CardDescription>
                OCR (creates an assessment with questions) or Canvas import. This is the structural ground truth for later
                assembly.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" disabled={!selectedCourse?.id} onClick={() => setExamUploadOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                OCR upload
              </Button>
              <Button type="button" variant="outline" disabled={!selectedCourse?.id} onClick={() => setCanvasImportOpen(true)}>
                Import from Canvas
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select baseline &amp; mark reference</CardTitle>
              <CardDescription>Choose the exam you uploaded and tag it as the reference baseline.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="min-w-[240px] flex-1 space-y-2">
                <span className="text-sm font-medium">Assessment</span>
                <Select
                  value={baselineAssessmentId}
                  onValueChange={setBaselineAssessmentId}
                  disabled={!selectedCourse?.id || assessments.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select assessment" />
                  </SelectTrigger>
                  <SelectContent>
                    {assessments.map((a) => (
                      <SelectItem key={a.id} value={a.id.toString()}>
                        {a.name} ({a.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="outline" onClick={markBaseline} disabled={!baselineAssessmentId}>
                Mark as reference baseline
              </Button>
              {baselineAssessment?.blueprintConfig?.studyRole === 'reference_baseline' && (
                <Badge className="w-fit bg-indigo-700">Reference</Badge>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">2 · Generate variants from baseline</h2>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" />
                Variants for each exam question
              </CardTitle>
              <CardDescription>
                For every base question on the baseline, the system promotes the primary variant and generates two alternate
                variants (EduAI), linked to the same metadata as the original items.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                disabled={!baselineAssessmentId || !selectedCourse?.id || generatingVariants}
                onClick={generateVariantsFromBaseline}
              >
                {generatingVariants ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate variants from baseline
                  </>
                )}
              </Button>
              {!baselineAssessmentId && (
                <span className="text-sm text-muted-foreground">Complete step 1 first.</span>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">3 · Assemble parallel exams</h2>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Match baseline structure</CardTitle>
              <CardDescription>
                Builds Exam A, B, and C with the same ordering and the same base question per slot as the baseline, using
                different variants so wording does not repeat across versions when possible.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                type="button"
                onClick={assembleStructureMatchedExams}
                disabled={!baselineAssessmentId || assembling || !selectedCourse}
              >
                {assembling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assembling…
                  </>
                ) : (
                  'Assemble Exam A, B & C'
                )}
              </Button>
              {lastAssembled.length > 0 && (
                <ul className="text-sm text-muted-foreground">
                  {lastAssembled.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        className="text-indigo-600 underline-offset-2 hover:underline"
                        onClick={() => navigate(`/assessments/${a.id}/builder`)}
                      >
                        {a.name}
                      </button>{' '}
                      <span className="text-slate-400">#{a.id}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">4 · Similarity checker</h2>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Structural similarity &amp; workflow metrics</CardTitle>
              <CardDescription>
                Compares topic, difficulty, and question-type distributions (1 − JSD), Jaccard overlap on base questions, and
                cross-exam variant reuse — your &quot;similarity code&quot; summary for analysis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                type="button"
                variant="secondary"
                onClick={runMetrics}
                disabled={metricsLoading || lastAssembled.length === 0}
              >
                {metricsLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Computing…
                  </>
                ) : (
                  'Run similarity checker'
                )}
              </Button>

              {metricsData && (
                <div className="space-y-4 rounded-lg border bg-white p-4 text-sm">
                  <div>
                    <span className="font-medium">Workflow</span>
                    <p className="text-muted-foreground">
                      Cross-exam variant reuse: {metricsData.workflow.variantsAppearingInMultipleExams} · AI placements:{' '}
                      {metricsData.workflow.aiGeneratedVariantPlacements} / {metricsData.workflow.totalQuestionPlacements}
                    </p>
                  </div>
                  {Array.isArray(metricsData.pairwise) && metricsData.pairwise.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="p-2">Pair</th>
                            <th className="p-2">Topic sim</th>
                            <th className="p-2">Difficulty sim</th>
                            <th className="p-2">Type sim</th>
                            <th className="p-2">Base Jaccard</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(metricsData.pairwise as Array<Record<string, number>>).map((row, i) => (
                            <tr key={i} className="border-b border-slate-100">
                              <td className="p-2">
                                #{row.assessmentIdA} / #{row.assessmentIdB}
                              </td>
                              <td className="p-2">{(row.topicDistributionSimilarity ?? 0).toFixed(3)}</td>
                              <td className="p-2">{(row.difficultyDistributionSimilarity ?? 0).toFixed(3)}</td>
                              <td className="p-2">{(row.questionTypeDistributionSimilarity ?? 0).toFixed(3)}</td>
                              <td className="p-2">{(row.baseQuestionJaccard ?? 0).toFixed(3)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      {selectedCourse?.id && (
        <>
          <QuestionUploadDialog
            open={examUploadOpen}
            onClose={() => setExamUploadOpen(false)}
            courseId={selectedCourse.id}
            courseName={selectedCourse.name}
            topics={topics}
            saveTarget="assessment"
            onEnsureTopics={async (cid) => {
              const t = await loadTopics(cid);
              return t;
            }}
            onQuestionsSaved={handleExamQuestionsSaved}
          />
          <CanvasImportDialog open={canvasImportOpen} onClose={() => setCanvasImportOpen(false)} onImportSuccess={handleCanvasImport} />
        </>
      )}
    </div>
  );
}
