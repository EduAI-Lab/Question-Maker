import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Plus, Upload } from 'lucide-react';

interface QuestionBankHeaderProps {
  questionCount: number;
  difficultyFilter: string;
  onAddQuestion: () => void;
  onUploadQuestions: () => void;
}

export const QuestionBankHeader = ({
  questionCount,
  difficultyFilter,
  onAddQuestion,
  onUploadQuestions
}: QuestionBankHeaderProps) => {
  return (
    <div className="space-y-4">
      {/* Main Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Question Bank</h2>
          <p className="text-sm text-gray-600">Lab / Midterm / Quiz</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onUploadQuestions} className="flex items-center space-x-2">
            <Upload className="h-4 w-4" />
            <span>Upload Questions</span>
          </Button>
          <Button onClick={onAddQuestion} className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Add Question</span>
          </Button>
        </div>
      </div>

      {/* Question Count and Filter Status */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          Questions ({questionCount})
        </h3>
        {difficultyFilter !== 'all' && (
          <Badge variant="secondary">
            Filtered by: {difficultyFilter}
          </Badge>
        )}
      </div>
    </div>
  );
};
