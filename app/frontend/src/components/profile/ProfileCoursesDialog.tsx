import { useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2 } from 'lucide-react';
import { Class } from '../../types/class';
import { eduaiService, EduAICourseOption, EduAITopicOption } from '../../services/eduaiService';
import { courseService } from '../../services/courseService';
import { useToast } from '../ui/use-toast';

interface ProfileCoursesDialogProps {
    open: boolean;
    onClose: () => void;
    existingCourses: Class[];
    onCoursesAdded?: () => Promise<void> | void;
}

const normalizeCourseCode = (value: string | null | undefined) =>
    value ? value.replace(/\s+/g, '').toLowerCase() : '';

export const ProfileCoursesDialog = ({
    open,
    onClose,
    existingCourses,
    onCoursesAdded
}: ProfileCoursesDialogProps) => {
    const [courseOptions, setCourseOptions] = useState<EduAICourseOption[]>([]);
    const [topicsByCourse, setTopicsByCourse] = useState<Record<string, EduAITopicOption[]>>({});
    const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const existingCourseCodeSet = useMemo(() => {
        const codes = new Set<string>();
        existingCourses.forEach((course) => {
            const candidates = [
                course.courseCode,
                course.code,
                course.subject,
                course.name
            ];
            candidates.forEach((candidate) => {
                const normalized = normalizeCourseCode(candidate ?? '');
                if (normalized) {
                    codes.add(normalized);
                }
            });
        });
        return codes;
    }, [existingCourses]);

    useEffect(() => {
        if (!open) {
            setSelectedCourseIds([]);
            setCourseOptions([]);
            setTopicsByCourse({});
            setError(null);
            return;
        }

        let isMounted = true;

        const loadCourses = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const options = await eduaiService.listCourses();
                if (!isMounted) return;
                setCourseOptions(options);

                const entries = await Promise.all(
                    options.map(async (option) => {
                        // Pass both the course ID and code to help with topic lookup
                        const topics = await eduaiService.listCourseTopics(option.id, option.code);
                        return [option.id, topics] as const;
                    })
                );

                if (!isMounted) return;
                setTopicsByCourse(Object.fromEntries(entries));
            } catch (err) {
                console.error('Failed to load EduAI courses', err);
                if (isMounted) {
                    setError('Failed to load EduAI courses. Please try again.');
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        void loadCourses();

        return () => {
            isMounted = false;
        };
    }, [open]);

    const toggleCourse = (courseId: string) => {
        setSelectedCourseIds((prev) =>
            prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
        );
    };

    const handleDialogChange = (value: boolean) => {
        if (!value && !isSaving) {
            onClose();
        }
    };

    const handleSave = async () => {
        const targetCourseIds = selectedCourseIds.filter((id) => {
            const option = courseOptions.find((item) => item.id === id);
            if (!option) {
                return false;
            }
            const normalized = normalizeCourseCode(option.code);
            return normalized && !existingCourseCodeSet.has(normalized);
        });

        if (targetCourseIds.length === 0) {
            toast({
                title: 'No new courses selected',
                description: 'Select at least one EduAI course that is not already in your library.'
            });
            return;
        }

        setIsSaving(true);
        try {
            const updatedCodes = new Set(existingCourseCodeSet);
            let createdCount = 0;

            for (const courseId of targetCourseIds) {
                const option = courseOptions.find((item) => item.id === courseId);
                if (!option) continue;

                const normalizedCode = normalizeCourseCode(option.code);
                if (normalizedCode && updatedCodes.has(normalizedCode)) {
                    continue;
                }

                const createdCourse = await courseService.createCourse({
                    name: option.name,
                    subject: option.name,
                    courseCode: option.code
                });

                if (normalizedCode) {
                    updatedCodes.add(normalizedCode);
                }

                const topics = topicsByCourse[courseId] ?? [];
                for (const topic of topics) {
                    await courseService.createTopic(createdCourse.id, topic.name);
                }

                createdCount += 1;
            }

            if (createdCount > 0) {
                if (onCoursesAdded) {
                    await onCoursesAdded();
                }
                toast({
                    title: `Added ${createdCount} course${createdCount > 1 ? 's' : ''}`,
                    description: 'Courses and topics have been synced from EduAI.'
                });
            } else {
                toast({
                    title: 'Courses already linked',
                    description: 'The selected courses were already in your library.'
                });
            }

            onClose();
        } catch (err) {
            console.error('Failed to add courses', err);
            setError('Unable to add selected courses. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleDialogChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Link courses from EduAI</DialogTitle>
                    <DialogDescription>
                        Select the courses you teach. We will import their topic lists into Question Maker.
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {error}
                    </div>
                )}

                <div className="mt-4 space-y-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12 text-muted-foreground">
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Loading courses...
                        </div>
                    ) : (
                        <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                            {courseOptions.map((option) => {
                                const normalized = normalizeCourseCode(option.code);
                                const isAdded = normalized ? existingCourseCodeSet.has(normalized) : false;
                                const isSelected = selectedCourseIds.includes(option.id);
                                const topics = topicsByCourse[option.id] ?? [];

                                return (
                                    <label
                                        key={option.id}
                                        className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 shadow-sm transition ${
                                            isAdded
                                                ? 'cursor-not-allowed border-muted bg-muted/40 opacity-80'
                                                : isSelected
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/40'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="mt-1 h-4 w-4"
                                            checked={isSelected}
                                            onChange={() => toggleCourse(option.id)}
                                            disabled={isAdded || isSaving}
                                        />
                                        <div className="flex-1 space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-semibold text-foreground">
                                                    {option.code} · {option.name}
                                                </span>
                                                {option.term && option.year && (
                                                    <Badge variant="outline" className="text-xs">
                                                        {option.term} {option.year}
                                                    </Badge>
                                                )}
                                                {isAdded && <Badge variant="outline">Already added</Badge>}
                                                {isSelected && !isAdded && !isSaving && (
                                                    <Badge variant="secondary">Selected</Badge>
                                                )}
                                            </div>
                                            {option.description && (
                                                <p className="text-xs text-muted-foreground">{option.description}</p>
                                            )}
                                            {topics.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {topics.map((topic) => (
                                                        <Badge key={topic.id} variant="outline" className="text-xs">
                                                            {topic.name}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </label>
                                );
                            })}

                            {courseOptions.length === 0 && (
                                <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                                    No courses available from EduAI right now.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || isLoading}>
                        {isSaving ? 'Linking…' : 'Add selected courses'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
