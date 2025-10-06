import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import type { ExtractedQuestion } from '../../types/question';

interface ExtractedQuestionCardProps {
    item: ExtractedQuestion;
    index: number;
}

const difficultyColors: Record<string, string> = {
    easy: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    hard: 'bg-red-100 text-red-800'
};

export const ExtractedQuestionCard = ({ item, index }: ExtractedQuestionCardProps) => {
    const difficultyBadge = item.difficulty ? (
        <Badge className={difficultyColors[item.difficulty] ?? 'bg-gray-100 text-gray-800'}>
            {item.difficulty}
        </Badge>
    ) : null;

    return (
        <Card className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-500">Q{index + 1}</span>
                    {difficultyBadge}
                </div>

                <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-line">
                    {item.question}
                </p>

                {item.instructions && (
                    <div className="rounded-md bg-gray-100 px-3 py-2">
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Instructions</p>
                        <p className="text-sm text-gray-700 whitespace-pre-line">{item.instructions}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
