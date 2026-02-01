/**
 * Detailed drawer/card for a question and its variants with actions for duplication and deletion.
 * Loads latest question data, displays metadata, and surfaces variant management controls.
 */
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { X, Copy, Trash2, ArrowLeft, Sparkles, FileEdit } from 'lucide-react';
import { QuestionVariantEntry, MCQChoice } from '../../types/question';
import { MCQChoicesField } from '../questions/MCQChoicesField';
import { questionService } from '../../services/questionService';
import { assessmentService } from '../../services/assessmentService';
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
                <div className="mt-2 text-sm font-medium text-gray-900 leading-relaxed whitespace-pre-line">
                    {value}
                </div>
                <p className="mt-3 text-xs font-medium text-blue-600">View all variants</p>
            </button>
        ) : (
            <div
                className={`rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm ${spanFull ? 'sm:col-span-2' : ''}`}
            >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                <div className="mt-2 text-sm font-medium text-gray-900 leading-relaxed whitespace-pre-line">
                    {value}
                </div>
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
    onUpdateVariant?: (
        variantId: number,
        updates: { isAiGenerated?: boolean; isDraft?: boolean; choices?: MCQChoice[] | null; answer?: string | null }
    ) => void;
}

export const QuestionDetailView = ({
    entry,
    relatedVariants,
    onClose,
    onCreateVariant,
    onDeleteVariant,
    onSelectVariant,
    onUpdateVariant
}: QuestionDetailViewProps) => {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<'detail' | 'variants'>('detail');
    const [isToggling, setIsToggling] = useState(false);
    const [isTogglingDraft, setIsTogglingDraft] = useState(false);
    const [editingChoices, setEditingChoices] = useState(false);
    const [editChoices, setEditChoices] = useState<MCQChoice[]>([]);
    const [editAnswer, setEditAnswer] = useState('');
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

    const questionTextDisplay = (variant.questionText || 'Untitled question').trim();
    const questionTextClass = useMemo(() => {
        if (questionTextDisplay.length > 320) {
            return 'text-base leading-relaxed';
        }
        if (questionTextDisplay.length > 200) {
            return 'text-lg leading-relaxed';
        }
        return 'text-2xl leading-8';
    }, [questionTextDisplay.length]);

    //mock for AI generated questions
    const handleToggleAiTag = async () => {
        try {
            setIsToggling(true);
            const updatedVariant = await questionService.updateVariant(entry.variant.id, {
                isAiGenerated: !entry.isAiGenerated
            });
            
            const newIsAiGenerated = updatedVariant.isAiGenerated ?? !entry.isAiGenerated;
            
            // Update the entry with the new value
            const updatedEntry: QuestionVariantEntry = {
                ...entry,
                isAiGenerated: newIsAiGenerated,
                variant: { ...entry.variant, ...updatedVariant }
            };
            
            onSelectVariant(updatedEntry);
            
            // Update parent state for hot reload
            if (onUpdateVariant) {
                onUpdateVariant(entry.variant.id, { isAiGenerated: newIsAiGenerated });
            }
            
            toast({
                title: 'AI tag toggled',
                description: `Variant is now ${newIsAiGenerated ? 'marked as' : 'unmarked from'} AI-generated.`
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

    const handleToggleDraft = async () => {
        try {
            setIsTogglingDraft(true);
            
            const updatedVariant = await questionService.updateVariant(entry.variant.id, {
                isDraft: !entry.isDraft
            });
            
            const newIsDraft = updatedVariant.isDraft ?? !entry.isDraft;
            
            // Update the entry with the new value
            const updatedEntry: QuestionVariantEntry = {
                ...entry,
                isDraft: newIsDraft,
                variant: { ...entry.variant, ...updatedVariant }
            };
            
            onSelectVariant(updatedEntry);
            
            // Update parent state for hot reload
            if (onUpdateVariant) {
                onUpdateVariant(entry.variant.id, { isDraft: newIsDraft });
            }
            
            toast({
                title: 'Review status updated',
                description: `Variant is now ${newIsDraft ? 'marked as draft' : 'marked as reviewed'}.`
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Failed to toggle draft status',
                description: error?.message || 'An error occurred'
            });
        } finally {
            setIsTogglingDraft(false);
        }
    };

    useEffect(() => {
        setViewMode('detail');
    }, [entry.variant.id]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
                        <div className={`text-gray-900 font-semibold ${questionTextClass} max-h-40 overflow-y-auto`}>
                            {questionTextDisplay}
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
                                    {entry.isDraft ? (
                                        <Badge variant="default" className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300">
                                            Draft
                                        </Badge>
                                    ) : (
                                        <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200 border-green-300">
                                            Reviewed
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
                                <DetailItem 
                                    label="Review Status" 
                                    value={
                                        entry.isDraft ? (
                                            <Badge variant="default" className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300">
                                                Draft
                                            </Badge>
                                        ) : (
                                            <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200 border-green-300">
                                                Reviewed
                                            </Badge>
                                        )
                                    } 
                                />
                            </div>
                        </section>

                        <section>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Relationships
                            </h3>
                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Assessment linkage
                                    </p>
                                    {variant.assessment ? (
                                        <button
                                            onClick={() => navigate(`/assessments/${variant.assessment!.id}`)}
                                            className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                                        >
                                            {variant.assessment.name} ({variant.assessment.semester})
                                        </button>
                                    ) : (
                                        <p className="mt-2 text-sm font-medium text-gray-900">Not linked</p>
                                    )}
                                </div>
                                <DetailItem label="Reference variant" value={variant.referenceId ?? 'None'} />
                            </div>
                        </section>

                        {entry.questionType === 'MCQ' && (editingChoices ? (
                            <section>
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                                    Edit choices
                                </h3>
                                <MCQChoicesField
                                    choices={editChoices}
                                    answer={editAnswer}
                                    onChoicesChange={setEditChoices}
                                    onAnswerChange={setEditAnswer}
                                    idPrefix="detail-mcq"
                                />
                                <div className="mt-3 flex gap-2">
                                    <Button
                                        size="sm"
                                        onClick={async () => {
                                            try {
                                                const validChoices = editChoices.filter((c) => c.text.trim().length > 0);
                                                await questionService.updateVariant(variant.id, {
                                                    choices: validChoices,
                                                    answer: editAnswer
                                                });
                                                const updatedVariant = { ...entry.variant, choices: validChoices, answer: editAnswer };
                                                const updatedEntry: QuestionVariantEntry = {
                                                    ...entry,
                                                    variant: updatedVariant
                                                };
                                                onSelectVariant(updatedEntry);
                                                onUpdateVariant?.(variant.id, { choices: validChoices, answer: editAnswer });
                                                setEditingChoices(false);
                                                toast({ title: 'Choices saved', description: 'Variant choices and correct answer updated.' });
                                            } catch (err: any) {
                                                toast({ variant: 'destructive', title: 'Failed to save choices', description: err?.message });
                                            }
                                        }}
                                    >
                                        Save choices
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setEditingChoices(false)}>
                                        Cancel
                                    </Button>
                                </div>
                            </section>
                        ) : variant.choices && variant.choices.length > 0 ? (
                            <section>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Choices
                                    </h3>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs"
                                        onClick={() => {
                                            setEditChoices(variant.choices!.map((c) => ({ ...c })));
                                            setEditAnswer(variant.answer?.trim().toUpperCase().charAt(0) ?? '');
                                            setEditingChoices(true);
                                        }}
                                    >
                                        Edit choices
                                    </Button>
                                </div>
                                <div className="mt-3 space-y-2">
                                    {variant.choices.map((choice, index) => {
                                        const isCorrect = variant.answer && choice.letter === variant.answer.trim().toUpperCase();
                                        return (
                                            <div
                                                key={index}
                                                className={`rounded-lg border p-4 shadow-sm ${
                                                    isCorrect
                                                        ? 'border-emerald-300 bg-emerald-50'
                                                        : 'border-gray-200 bg-gray-50'
                                                }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <span
                                                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                                            isCorrect
                                                                ? 'bg-emerald-500 text-white'
                                                                : 'bg-gray-200 text-gray-700'
                                                        }`}
                                                    >
                                                        {choice.letter}
                                                    </span>
                                                    <p className="flex-1 text-sm font-medium text-gray-900 leading-relaxed">
                                                        {choice.text}
                                                    </p>
                                                    {isCorrect && (
                                                        <span className="text-xs font-semibold text-emerald-700">
                                                            Correct
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        ) : (
                            <section>
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Choices
                                </h3>
                                <p className="mt-2 text-sm text-muted-foreground">No choices defined.</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-2"
                                    onClick={() => {
                                        setEditChoices([
                                            { letter: 'A', text: '' },
                                            { letter: 'B', text: '' },
                                            { letter: 'C', text: '' },
                                            { letter: 'D', text: '' }
                                        ]);
                                        setEditAnswer('');
                                        setEditingChoices(true);
                                    }}
                                >
                                    Add choices
                                </Button>
                            </section>
                        ))}

                        {variant.answer && !(entry.questionType === 'MCQ' && editingChoices) && (
                            <section>
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    {entry.questionType === 'MCQ' ? 'Correct Answer' : 'Answer'}
                                </h3>
                                <div className="mt-3 rounded-lg border border-gray-200 bg-emerald-50/60 p-5 shadow-sm">
                                    <p className="text-sm font-medium text-gray-900 leading-relaxed whitespace-pre-line">
                                        {entry.questionType === 'MCQ' && variant.choices && variant.choices.length > 0
                                            ? (() => {
                                                const letter = variant.answer.trim().toUpperCase().charAt(0);
                                                const choice = variant.choices.find((c) => c.letter === letter);
                                                return choice ? `${choice.letter}) ${choice.text}` : `Option ${variant.answer.toUpperCase()}`;
                                            })()
                                            : variant.answer
                                        }
                                    </p>
                                </div>
                            </section>
                        )}
                    </div>
                    )}
                </div>

                <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-4">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleToggleAiTag}
                            disabled={isToggling}
                            className="flex items-center gap-2 text-xs border-purple-300 text-purple-700 hover:bg-purple-50"
                            title="Toggle AI Generated status"
                        >
                            <Sparkles className="h-3 w-3" />
                            <span>{entry.isAiGenerated ? 'Remove AI Tag' : 'Add AI Tag'}</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleToggleDraft}
                            disabled={isTogglingDraft}
                            className="flex items-center gap-2 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                            title="Toggle review status"
                        >
                            <FileEdit className="h-3 w-3" />
                            <span>{entry.isDraft ? 'Mark as Reviewed' : 'Mark as Draft'}</span>
                        </Button>
                    </div>
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
