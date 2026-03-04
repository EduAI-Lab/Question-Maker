/**
 * Question parameters panel: type, primary topic, secondary topics, difficulty, reasoning, description.
 * Matches prototype layout (compact labels, card-style) for use in AddQuestionDialog left column.
 */
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '../ui/select';
import {
    QuestionType,
    QuestionDifficulty,
    ReasoningLevel,
    questionTypeLabels
} from '../../types/question';
import { Topic } from '../../types/topic';

export interface QuestionMetadataPanelValue {
    questionType: QuestionType;
    primaryTopicId: string;
    questionDescription: string;
    variantDifficulty: QuestionDifficulty;
    variantReasoningLevel: ReasoningLevel;
    variantSecondaryTopics: number[];
}

interface QuestionMetadataPanelProps {
    value: QuestionMetadataPanelValue;
    onChange: (field: keyof QuestionMetadataPanelValue, value: QuestionMetadataPanelValue[keyof QuestionMetadataPanelValue]) => void;
    topics: Topic[];
    isAuxLoading?: boolean;
    disabled?: boolean;
    /** In variant mode, primary topic is read-only from preset; still need to show it */
    mode: 'new' | 'variant';
    primaryTopicName?: string;
    onToggleSecondaryTopic: (topicId: number, checked: boolean) => void;
}

const difficultyOptions: QuestionDifficulty[] = ['easy', 'medium', 'hard'];
const reasoningLevelOptions: ReasoningLevel[] = ['factual', 'analytical', 'application'];
const reasoningLevelLabels: Record<ReasoningLevel, string> = {
    factual: 'Factual',
    analytical: 'Analytical',
    application: 'Application'
};
const questionTypes: QuestionType[] = ['MCQ', 'SA', 'LA'];

export function QuestionMetadataPanel({
    value,
    onChange,
    topics,
    isAuxLoading = false,
    disabled = false,
    mode,
    primaryTopicName,
    onToggleSecondaryTopic
}: QuestionMetadataPanelProps) {
    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Question Type
                </Label>
                {mode === 'variant' ? (
                    <p className="text-sm text-muted-foreground py-2">{questionTypeLabels[value.questionType]}</p>
                ) : (
                    <Select
                        value={value.questionType}
                        onValueChange={(v) => onChange('questionType', v as QuestionType)}
                        disabled={disabled}
                    >
                        <SelectTrigger className="bg-secondary border-border h-9">
                            <SelectValue placeholder="Select question type" />
                        </SelectTrigger>
                        <SelectContent>
                            {questionTypes.map((t) => (
                                <SelectItem key={t} value={t}>
                                    {questionTypeLabels[t]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Primary Topic <span className="text-destructive">*</span>
                </Label>
                {mode === 'variant' && primaryTopicName ? (
                    <p className="text-sm text-muted-foreground py-2">{primaryTopicName}</p>
                ) : (
                    <Select
                        value={value.primaryTopicId}
                        onValueChange={(v) => onChange('primaryTopicId', v)}
                        disabled={disabled || topics.length === 0}
                    >
                        <SelectTrigger className="bg-secondary border-border h-9">
                            <SelectValue
                                placeholder={
                                    topics.length === 0
                                        ? isAuxLoading
                                            ? 'Loading topics...'
                                            : 'No topics available'
                                        : 'Select a topic'
                                }
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {topics.length === 0 ? (
                                <SelectItem value="__no_topics" disabled>
                                    {isAuxLoading ? 'Loading topics...' : 'No topics available'}
                                </SelectItem>
                            ) : (
                                topics.map((topic) => (
                                    <SelectItem key={topic.id} value={topic.id.toString()}>
                                        {topic.name}
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Difficulty
                    </Label>
                    <Select
                        value={value.variantDifficulty}
                        onValueChange={(v) => onChange('variantDifficulty', v as QuestionDifficulty)}
                        disabled={disabled}
                    >
                        <SelectTrigger className="bg-secondary border-border h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {difficultyOptions.map((opt) => (
                                <SelectItem key={opt} value={opt} className="capitalize">
                                    {opt}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Reasoning Focus
                    </Label>
                    <Select
                        value={value.variantReasoningLevel}
                        onValueChange={(v) => onChange('variantReasoningLevel', v as ReasoningLevel)}
                        disabled={disabled}
                    >
                        <SelectTrigger className="bg-secondary border-border h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {reasoningLevelOptions.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                    {reasoningLevelLabels[opt]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

        </div>
    );
}
