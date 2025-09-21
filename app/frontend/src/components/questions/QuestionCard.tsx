import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Trash2 } from 'lucide-react';
import { Question } from '../../types/question';
import { useTheme } from '../theme-provider';

interface QuestionCardProps {
  question: Question;
  onDelete: (id: number) => Promise<{ success: boolean; error?: string }>;
}

export const QuestionCard = ({ question, onDelete }: QuestionCardProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { theme } = useTheme();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(question.id);
    } catch (error) {
      console.error('Error deleting question:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
      case 'hard':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-800';
    }
  };

  const getBloomLevelColor = (bloomLevel: string) => {
    switch (bloomLevel) {
      case 'remember':
      case 'understand':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      case 'apply':
      case 'analyze':
        return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
      case 'evaluate':
      case 'create':
        return 'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-800';
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 relative">
        <div className="flex justify-between items-start gap-4">
          <p className={`flex-1 ${theme === 'light' ? 'text-gray-800' : 'text-gray-200'}`}>
            {question.content}
          </p>
          <div className="flex flex-col items-end gap-2 min-w-[140px]">
            <div className="flex gap-2">
              <Badge
                variant="outline"
                className={`capitalize whitespace-nowrap ${getDifficultyColor(question.difficulty)}`}
              >
                {question.difficulty}
              </Badge>
              <Badge
                variant="outline"
                className={`capitalize whitespace-nowrap ${getBloomLevelColor(question.bloomLevel)}`}
              >
                {question.bloomLevel}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className={`hover:bg-red-100 hover:text-red-500 ${
                theme === 'light' ? 'text-gray-600' : 'text-gray-400'
              }`}
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className={`text-xs mt-2 ${
          theme === 'light' ? 'text-gray-600' : 'text-gray-400'
        }`}>
          {new Date(question.createdAt).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
};

