import React from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Trash2, X } from 'lucide-react';
import type { AssessmentSection, SectionVariantLink, QuestionVariantEntry } from '../../types/question';

interface AssessmentSectionCardProps {
    section: AssessmentSection;
    sectionIndex: number;
    questionLinks: SectionVariantLink[];
    questionBank: QuestionVariantEntry[];
    onUpdateTitle: (name: string) => void;
    onRemoveQuestion: (linkId: number) => void;
    onDeleteSection: () => void;
    onAddQuestions: () => void;
}

export function AssessmentSectionCard({
    section,
    sectionIndex,
    questionLinks,
    questionBank,
    onUpdateTitle,
    onRemoveQuestion,
    onDeleteSection,
    onAddQuestions
}: AssessmentSectionCardProps) {
    const questions = React.useMemo(
        () =>
            questionLinks
                .map((link) => {
                    const entry = questionBank.find((q) => q.variant.id === link.variantId);
                    if (!entry) return null;
                    return {
                        linkId: link.id,
                        text: entry.variant.questionText,
                        type: entry.questionType,
                        difficulty: entry.variant.difficulty,
                        primaryTopicName: entry.primaryTopicName
                    };
                })
                .filter(Boolean) as Array<{
                linkId: number;
                text: string;
                type: QuestionVariantEntry['questionType'];
                difficulty: QuestionVariantEntry['variant']['difficulty'];
                primaryTopicName?: string;
            }>,
        [questionLinks, questionBank]
    );

    return (
        <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
            <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground shrink-0">Section {sectionIndex + 1}</span>
                <Input
                    value={section.name}
                    onChange={(event) => onUpdateTitle(event.target.value)}
                    placeholder={`Section ${sectionIndex + 1}`}
                    className="bg-card border-border font-medium h-9"
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onDeleteSection}
                    className="text-muted-foreground hover:text-destructive shrink-0 h-8 w-8 p-0"
                    aria-label="Delete section"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>

            {questions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border bg-card/50 p-6">
                    <p className="text-sm text-muted-foreground">No questions added yet</p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onAddQuestions}
                        className="gap-1.5"
                    >
                        Add questions
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {questions.map((q, idx) => (
                        <div
                            key={q.linkId}
                            className="flex items-start gap-3 rounded-md border border-border bg-card p-3 group"
                        >
                            <span className="text-xs font-mono text-muted-foreground mt-0.5 shrink-0 w-5 text-right">
                                {idx + 1}.
                            </span>
                            <div className="flex-1 min-w-0 space-y-1">
                                <p className="text-sm text-foreground line-clamp-2 leading-relaxed">{q.text}</p>
                                <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                                        {q.type}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                                        {q.difficulty}
                                    </Badge>
                                    {q.primaryTopicName && (
                                        <span className="text-[10px] text-muted-foreground truncate">
                                            {q.primaryTopicName}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => onRemoveQuestion(q.linkId)}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                aria-label="Remove question"
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ))}

                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onAddQuestions}
                        className="gap-1.5 text-muted-foreground hover:text-foreground self-start mt-1"
                    >
                        Add more questions
                    </Button>
                </div>
            )}
        </div>
    );
}

