import React, { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Assessment, AssessmentSection, QuestionVariantEntry, SectionVariantLink, Topic } from '../../types/question';
import { AssessmentSectionCard } from './AssessmentSectionCard';
import { AssessmentQuestionPicker } from './AssessmentQuestionPicker';

interface AssessmentBuilderProps {
    assessment: Assessment;
    questionBank: QuestionVariantEntry[];
    topics: Topic[];
    onChange: (updated: Assessment) => void;
    onSave?: (updated: Assessment) => Promise<void> | void;
    isSaving?: boolean;
}

export function AssessmentBuilder({
    assessment,
    questionBank,
    topics,
    onChange,
    onSave,
    isSaving
}: AssessmentBuilderProps) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerSectionId, setPickerSectionId] = useState<number | null>(null);

    const sections = useMemo<AssessmentSection[]>(() => {
        const list = [...(assessment.sections ?? [])];
        return list.sort((a, b) => a.position - b.position);
    }, [assessment.sections]);

    const handleUpdateAssessment = (updater: (prev: Assessment) => Assessment) => {
        const next = updater(assessment);
        onChange(next);
    };

    const handleAddSection = () => {
        const existing = assessment.sections ?? [];
        const nextId = existing.length > 0 ? Math.max(...existing.map((s) => s.id)) + 1 : 1;
        const nextPosition = existing.length > 0 ? Math.max(...existing.map((s) => s.position)) + 1 : 1;
        const newSection: AssessmentSection = {
            id: nextId,
            assessmentId: assessment.id,
            name: `Section ${existing.length + 1}`,
            position: nextPosition,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sectionVariants: []
        };

        handleUpdateAssessment((prev) => ({
            ...prev,
            sections: [...(prev.sections ?? []), newSection]
        }));
    };

    const handleUpdateSectionName = (sectionId: number, name: string) => {
        handleUpdateAssessment((prev) => ({
            ...prev,
            sections: (prev.sections ?? []).map((section) =>
                section.id === sectionId ? { ...section, name } : section
            )
        }));
    };

    const handleDeleteSection = (sectionId: number) => {
        handleUpdateAssessment((prev) => ({
            ...prev,
            sections: (prev.sections ?? []).filter((section) => section.id !== sectionId)
        }));
    };

    const handleRemoveQuestion = (sectionId: number, linkId: number) => {
        handleUpdateAssessment((prev) => ({
            ...prev,
            sections: (prev.sections ?? []).map((section) =>
                section.id === sectionId
                    ? {
                          ...section,
                          sectionVariants: (section.sectionVariants ?? []).filter((link) => link.id !== linkId)
                      }
                    : section
            )
        }));
    };

    const handleAddQuestionsToSection = (sectionId: number, variantIds: number[]) => {
        handleUpdateAssessment((prev) => {
            const sectionsWithVariants = prev.sections ?? [];
            const target = sectionsWithVariants.find((s) => s.id === sectionId);
            if (!target) return prev;

            const existingLinks = target.sectionVariants ?? [];
            const existingIds = new Set(existingLinks.map((link) => link.variantId));
            const baseDisplayOrder =
                existingLinks.length > 0 ? Math.max(...existingLinks.map((l) => l.displayOrder)) + 1 : 1;
            let nextDisplayOrder = baseDisplayOrder;

            const maxLinkId =
                sectionsWithVariants
                    .flatMap((s) => s.sectionVariants ?? [])
                    .reduce((max, link) => Math.max(max, link.id), 0) || 0;
            let nextLinkId = maxLinkId + 1;

            const newLinks: SectionVariantLink[] = [];
            variantIds.forEach((variantId) => {
                if (existingIds.has(variantId)) return;
                newLinks.push({
                    id: nextLinkId++,
                    sectionId,
                    variantId,
                    displayOrder: nextDisplayOrder++,
                    metadata: null
                });
            });

            const updatedSections = sectionsWithVariants.map((section) =>
                section.id === sectionId
                    ? {
                          ...section,
                          sectionVariants: [...existingLinks, ...newLinks]
                      }
                    : section
            );

            return {
                ...prev,
                sections: updatedSections
            };
        });
    };

    const currentSectionQuestionIds = useMemo(() => {
        if (!pickerSectionId) return [];
        const section = sections.find((s) => s.id === pickerSectionId);
        if (!section || !section.sectionVariants) return [];
        return section.sectionVariants.map((link) => link.variantId);
    }, [pickerSectionId, sections]);

    const handleSave = () => {
        if (!onSave) return;
        void onSave(assessment);
    };

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">{assessment.name}</h2>
                    <p className="text-xs text-muted-foreground">
                        Arrange sections and assign questions to this assessment.
                    </p>
                </div>
                {onSave && (
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Saving…' : 'Save changes'}
                    </Button>
                )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)] h-full">
                <ScrollArea className="h-full pr-2">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Sections
                            </h3>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleAddSection}
                            >
                                Add section
                            </Button>
                        </div>

                        {sections.length === 0 ? (
                            <div className="rounded-md border border-dashed border-border bg-secondary/30 p-8 text-center text-sm text-muted-foreground">
                                No sections yet. Click &quot;Add section&quot; to get started.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {sections.map((section, index) => (
                                    <AssessmentSectionCard
                                        key={section.id}
                                        section={section}
                                        sectionIndex={index}
                                        questionLinks={section.sectionVariants ?? []}
                                        questionBank={questionBank}
                                        onUpdateTitle={(name) => handleUpdateSectionName(section.id, name)}
                                        onRemoveQuestion={(linkId) => handleRemoveQuestion(section.id, linkId)}
                                        onDeleteSection={() => handleDeleteSection(section.id)}
                                        onAddQuestions={() => {
                                            setPickerSectionId(section.id);
                                            setPickerOpen(true);
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            <AssessmentQuestionPicker
                open={pickerOpen}
                onOpenChange={(open) => {
                    setPickerOpen(open);
                    if (!open) setPickerSectionId(null);
                }}
                questionBank={questionBank}
                excludeVariantIds={currentSectionQuestionIds}
                topics={topics}
                onConfirm={(variantIds) => {
                    if (!pickerSectionId) return;
                    handleAddQuestionsToSection(pickerSectionId, variantIds);
                    setPickerOpen(false);
                    setPickerSectionId(null);
                }}
            />
        </div>
    );
}

