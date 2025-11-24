import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { X, Copy, Trash2, ArrowLeft, Sparkles } from 'lucide-react';
import { QuestionVariantEntry } from '../../types/question';
import { questionService } from '../../services/questionService';
import { useToast } from '../ui/use-toast';

const DetailItem = ({
    label,
    value,
    spanFull = false,
    onClick
}: {
    label: string;
    value: ReactNode;
    spanFull?: boolean;
    onClick?: () => void;
}) => (
    <>
        {onClick ? (
            <button
                type="button"
                onClick={onClick}
                className={`rounded-lg border border-gray-200 bg-gray-50 p-4 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${spanFull ? 'sm:col-span-2' : ''}`}
            >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-2 text-sm font-medium text-gray-900 leading-relaxed whitespace-pre-line">
                    {value}
                </p>
                <p className="mt-3 text-xs font-medium text-blue-600">View all variants</p>
            </button>
        ) : (
            <div
                className={`rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm ${spanFull ? 'sm:col-span-2' : ''}`}
            >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-2 text-sm font-medium text-gray-900 leading-relaxed whitespace-pre-line">
                    {value}
                </p>
            </div>
        )}
    </>
);

interface QuestionDetailViewProps {
    entry: QuestionVariantEntry;
    relatedVariants: QuestionVariantEntry[];
    onClose: () => void;
    onCreateVariant: (entry: QuestionVariantEntry) => void;
    onDeleteVariant: (entry: QuestionVariantEntry) => void;
    onSelectVariant: (entry: QuestionVariantEntry) => void;
}

export const QuestionDetailView = ({
    entry,
    relatedVariants,
    onClose,
    onCreateVariant,
    onDeleteVariant,
    onSelectVariant
}: QuestionDetailViewProps) => {
    const [viewMode, setViewMode] = useState<'detail' | 'variants'>('detail');
    const [isToggling, setIsToggling] = useState(false);
    const { toast } = useToast();
    const { variant } = entry;
    const primaryTopicLabel = entry.primaryTopicName ?? `Topic ${entry.primaryTopicId}`;
    const secondaryTopicsDisplay =
        entry.secondaryTopicNames && entry.secondaryTopicNames.length > 0
            ? entry.secondaryTopicNames.join(', ')
            : variant.secondaryTopicsId && variant.secondaryTopicsId.length > 0
                ? variant.secondaryTopicsId.map((id) => `Topic ${id}`).join(', ')
                : '—';

    const createdTimestamp =
        variant.createdAt ??
        variant.updatedAt ??
        (variant as Record<string, any>)?.created_at ??
        (variant as Record<string, any>)?.updated_at;
    const createdAtDisplay =
        createdTimestamp && !Number.isNaN(new Date(createdTimestamp).getTime())
            ? new Date(createdTimestamp).toLocaleString()
            : '—';

    const siblingVariants = useMemo(
        () =>
            relatedVariants
                .slice()
                .sort(
                    (a, b) =>
                        new Date(b.variant.createdAt || b.variant.updatedAt || 0).getTime() -
                        new Date(a.variant.createdAt || a.variant.updatedAt || 0).getTime()
                ),
        [relatedVariants]
    );

    const formatTimestamp = (value?: string | null) => {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
    };

    const handleViewAllVariants = () => {
        setViewMode('variants');
    };

    const handleSelectVariant = (target: QuestionVariantEntry) => {
        onSelectVariant(target);
        setViewMode('detail');
    };
 //mock for AI generated questions
    const handleToggleAiTag = async () => {
        try {
            setIsToggling(true);
            const updatedQuestion = await questionService.updateQuestion(entry.questionId, {
                isAiGenerated: !entry.isAiGenerated
            });
            
            // Update the entry with the new value
            const updatedEntry: QuestionVariantEntry = {
                ...entry,
                isAiGenerated: updatedQuestion.isAiGenerated
            };
            
            onSelectVariant(updatedEntry);
            
            toast({
                title: 'AI tag toggled',
                description: `Question is now ${updatedQuestion.isAiGenerated ? 'marked as' : 'unmarked from'} AI-generated.`
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Failed to toggle AI tag',
                description: error?.message || 'An error occurred'
            });
        } finally {
            setIsToggling(false);
        }
    };

    useEffect(() => {
        setViewMode('detail');
    }, [entry.variant.id]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-full hover:bg-muted"
                    aria-label="Close"
                >
                    <X className="h-4 w-4" />
                </Button>

                <div className="px-6 pt-10 pr-14">
                    {viewMode === 'variants' ? (
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900">All variants for this question</h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {entry.questionDescription || 'Question metadata'}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="flex items-center gap-2"
                                onClick={() => setViewMode('detail')}
                            >
                                <ArrowLeft className="h-4 w-4" />
                                <span>Back to details</span>
                            </Button>
                        </div>
                    ) : (
                        <div className="text-2xl font-semibold leading-8 text-gray-900">
                            {variant.questionText || 'Untitled question'}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6">
                    {viewMode === 'variants' ? (
                        <div className="space-y-6">
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 shadow-sm">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Question synopsis
                                </p>
                                <p className="mt-2 text-sm font-medium text-gray-900 leading-relaxed">
                                    {entry.questionDescription || '—'}
                                </p>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">{entry.primaryTopicName ?? `Topic ${entry.primaryTopicId}`}</Badge>
                                    <Badge variant="secondary" className="uppercase">{entry.questionType}</Badge>
                                    {entry.isAiGenerated && (
                                        <Badge variant="default" className="bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-300">
                                            AI Generated
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                {siblingVariants.map((item, index) => {
                                    const isActive = item.variant.id === variant.id;
                                    const timestamp =
                                        item.variant.createdAt || item.variant.updatedAt || '';
                                    return (
                                        <button
                                            key={`${item.questionId}-${item.variant.id}`}
                                            type="button"
                                            onClick={() => handleSelectVariant(item)}
                                            className={`w-full rounded-lg border p-4 text-left shadow-sm transition ${
                                                isActive
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50'
                                            }`}
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div className="text-sm font-semibold text-gray-900">
                                                    Variant {index + 1}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <Badge variant="outline" className="capitalize">
                                                            {item.variant.difficulty ?? 'medium'}
                                                        </Badge>
                                                    <span>{formatTimestamp(timestamp)}</span>
                                                </div>
                                            </div>
                                            <p className="mt-2 text-sm text-gray-700 line-clamp-3 leading-relaxed">
                                                {item.variant.questionText}
                                            </p>
                                        </button>
                                    );
                                })}

                                {siblingVariants.length === 0 && (
                                    <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-muted-foreground">
                                        No variants available for this question metadata yet.
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                    <div className="space-y-10">
                        <section>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Synopsis
                            </h3>
                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <DetailItem
                                    label="Question synopsis"
                                    value={entry.questionDescription || '—'}
                                    spanFull
                                    onClick={handleViewAllVariants}
                                />
                            </div>
                        </section>

                        <section>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Topic coverage
                            </h3>
                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <DetailItem label="Primary topic" value={primaryTopicLabel} />
                                <DetailItem label="Secondary topics" value={secondaryTopicsDisplay} />
                            </div>
                        </section>

                        <section>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Variant details
                            </h3>
                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <DetailItem label="Question type" value={entry.questionType} />
                                <DetailItem label="Difficulty" value={variant.difficulty ?? '—'} />
                                <DetailItem label="Created" value={createdAtDisplay} />
                                {entry.isAiGenerated && (
                                    <DetailItem label="AI Generated" value={
                                        <Badge variant="default" className="bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-300">
                                            Yes
                                        </Badge>
                                    } />
                                )}
                            </div>
                        </section>

                        <section>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Relationships
                            </h3>
                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <DetailItem
                                    label="Assessment linkage"
                                    value={variant.assessmentId ?? 'Not linked'}
                                />
                                <DetailItem label="Reference variant" value={variant.referenceId ?? 'None'} />
                            </div>
                        </section>

                        {variant.answer && (
                            <section>
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Answer
                                </h3>
                                <div className="mt-3 rounded-lg border border-gray-200 bg-emerald-50/60 p-5 shadow-sm">
                                    <p className="text-sm font-medium text-gray-900 leading-relaxed whitespace-pre-line">
                                        {variant.answer}
                                    </p>
                                </div>
                            </section>
                        )}
                    </div>
                    )}
                </div>

                <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleToggleAiTag}
                        disabled={isToggling}
                        className="flex items-center gap-2 text-xs border-purple-300 text-purple-700 hover:bg-purple-50"
                        title="Test: Toggle AI Generated tag"
                    >
                        <Sparkles className="h-3 w-3" />
                        <span>{entry.isAiGenerated ? 'Remove AI Tag' : 'Add AI Tag'}</span>
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => onCreateVariant(entry)} className="flex items-center gap-2">
                            <Copy className="h-4 w-4" />
                            <span>Create variant</span>
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => onDeleteVariant(entry)}
                            className="flex items-center gap-2"
                        >
                            <Trash2 className="h-4 w-4" />
                            <span>Delete variant</span>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
