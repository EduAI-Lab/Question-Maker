import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

interface QuestionCardProps {
  content: string;
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: string;
}

const difficultyColors = {
  easy: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  hard: 'bg-red-100 text-red-800'
};

const QuestionCard = ({ content, difficulty, createdAt }: QuestionCardProps) => {
  return (
    <Card className="mb-4 relative">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-2">
          <p className="text-lg font-medium">
            {content}
          </p>
          <Badge
            className={`absolute top-2 right-2 px-2 py-1 rounded-full capitalize ${difficultyColors[difficulty]}`}
          >
            {difficulty}
          </Badge>
        </div>
        <p className="text-sm text-gray-500">
          Created: {new Date(createdAt).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
};

export default QuestionCard; 