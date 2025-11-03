import { ReactNode } from 'react';
import { Button } from '../ui/button';
import { X, Copy, Trash2 } from 'lucide-react';
import { QuestionVariantEntry } from '../../types/question';

const DetailItem = ({
    label,
    value,
    spanFull = false
}: {
    label: string;
    value: ReactNode;
    spanFull?: boolean;
}) => (
    <div
        className={`rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm ${spanFull ? 'sm:col-span-2' : ''}`}
    >
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-sm font-medium text-gray-900 leading-relaxed whitespace-pre-line">
            {value}
        </p>
    </div>
);

interface QuestionDetailViewProps {
    entry: QuestionVariantEntry;
    onClose: () => void;
    onCreateVariant: (entry: QuestionVariantEntry) => void;
    onDeleteVariant: (entry: QuestionVariantEntry) => void;
}

export const QuestionDetailView = ({
    entry,
    onClose,
    onCreateVariant,
    onDeleteVariant
}: QuestionDetailViewProps) => {
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

                <div className="px-6 pt-10 pr-14 text-2xl font-semibold leading-8 text-gray-900">
                    {variant.questionText || 'Untitled question'}
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6">
                    <div className="space-y-10">
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

                        <section>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Synopsis
                            </h3>
                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <DetailItem
                                    label="Question synopsis"
                                    value={entry.questionDescription || '—'}
                                    spanFull
                                />
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
                </div>

                <div className="flex items-center justify-end gap-3 border-t bg-gray-50 px-6 py-4">
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
