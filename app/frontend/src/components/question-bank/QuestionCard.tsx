import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Eye, Copy, Layers } from 'lucide-react';
import { Question } from '../../types/question';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  onViewQuestion: (question: Question) => void;
  onCreateVariant: (question: Question) => void;
}

export const QuestionCard = ({
  question,
  questionNumber,
  onViewQuestion,
  onCreateVariant
}: QuestionCardProps) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            {/* Question Header with Badges */}
            <div className="flex items-center space-x-3 mb-4">
              <span className="text-sm font-medium text-gray-500">
                Q{questionNumber}
              </span>
              <Badge variant="secondary" className="uppercase">
                {question.type}
              </Badge>
              {question.course && (
                <Badge variant="outline">
                  {question.course.name}
                </Badge>
              )}
              <Badge variant="outline" className="flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {question.variants?.length ?? 0} variants
              </Badge>
            </div>
            
            {/* Question Content */}
            <div className="mb-4">
              <p className="text-gray-900 line-clamp-2 leading-relaxed">
                {question.description || question.content || '—'}
              </p>
            </div>
            
            {/* Creation Date */}
            <p className="text-xs text-gray-500">
              Created: {new Date(question.createdAt).toLocaleDateString()}
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewQuestion(question)}
              className="flex items-center space-x-1"
            >
              <Eye className="h-4 w-4" />
              <span>View</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCreateVariant(question)}
              className="flex items-center space-x-1"
            >
              <Copy className="h-4 w-4" />
              <span>Variant</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
