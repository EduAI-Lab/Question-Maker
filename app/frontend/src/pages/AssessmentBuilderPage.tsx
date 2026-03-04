import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import assessmentService from '../services/assessmentService';
import { courseService } from '../services/courseService';
import { questionService } from '../services/questionService';
import { Assessment, Question, QuestionVariantEntry } from '../types/question';
import { Topic } from '../types/topic';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { AssessmentBuilder } from '../components/assessments/AssessmentBuilder';

const AssessmentBuilderPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const assessmentId = Number(id);

    const [assessment, setAssessment] = useState<Assessment | null>(null);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            if (Number.isNaN(assessmentId)) return;
            try {
                setIsLoading(true);
                setError(null);
                const loadedAssessment = await assessmentService.getAssessment(assessmentId);
                setAssessment(loadedAssessment);

                if (loadedAssessment.course?.id) {
                    const [courseTopics, courseQuestions] = await Promise.all([
                        courseService.getCourseTopics(loadedAssessment.course.id),
                        questionService.getQuestions({ courseId: loadedAssessment.course.id, limit: 500 })
                    ]);
                    setTopics(courseTopics);
                    setQuestions(courseQuestions);
                } else {
                    setTopics([]);
                    setQuestions([]);
                }
            } catch (loadError: any) {
                setError(loadError?.response?.data?.error || 'Failed to load assessment builder');
            } finally {
                setIsLoading(false);
            }
        };

        load();
    }, [assessmentId]);

    const topicById = useMemo(() => {
        const map: Record<number, Topic> = {};
        topics.forEach((topic) => {
            map[topic.id] = topic;
        });
        return map;
    }, [topics]);

    const questionVariantEntries = useMemo<QuestionVariantEntry[]>(() => {
        const resolveTopicName = (topicId: number) => topicById[topicId]?.name ?? `Topic ${topicId}`;
        return questions.flatMap((question) =>
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
                    isAiGenerated: variant.isAiGenerated,
                    isDraft: variant.isDraft,
                    variant
                };
            })
        );
    }, [questions, topicById]);

    if (isLoading) {
        return (
            <div className="p-6">
                <p className="text-sm text-muted-foreground">Loading assessment builder…</p>
            </div>
        );
    }

    if (!assessment || error) {
        return (
            <div className="p-6 space-y-3">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(-1)}
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </Button>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Assessment builder</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-destructive">
                            {error ?? 'Assessment not found or failed to load.'}
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(-1)}
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </Button>
                <h1 className="text-lg font-semibold text-foreground">Assessment builder</h1>
            </div>

            <AssessmentBuilder
                assessment={assessment}
                questionBank={questionVariantEntries}
                topics={topics}
                onChange={setAssessment}
            />
        </div>
    );
};

export default AssessmentBuilderPage;

