import { AddQuestion } from './AddQuestion';
import type { SavedExtractedQuestion } from '../../types/question';

interface QuestionBankHeaderProps {
    questionCount: number;
    difficultyFilter: string;
    courseId?: number;
    onAddQuestion?: (saved: SavedExtractedQuestion[]) => void;
}

export const QuestionBankHeader = ({
    questionCount,
    difficultyFilter,
    courseId,
    onAddQuestion
}: QuestionBankHeaderProps) => {
    return (
        <div className="space-y-4">
            {/* Main Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Question Bank</h2>
                    <p className="text-sm text-gray-600">Lab / Midterm / Quiz</p>
                </div>
                <AddQuestion courseId={courseId} onAddQuestion={onAddQuestion} />
            </div>

            {/* Question Count and Filter Status */}
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">
                    Questions ({questionCount})
                </h3>
            </div>
        </div>
    );
};
