import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { X, Edit, Copy, Trash2 } from 'lucide-react';
import { Question } from '../../types/question';

interface QuestionDetailViewProps {
  question: Question | null;
  onClose: () => void;
  onEdit: (question: Question) => void;
  onCreateVariant: (question: Question) => void;
  onDelete: (question: Question) => void;
}

export const QuestionDetailView = ({
  question,
  onClose,
  onEdit,
  onCreateVariant,
  onDelete
}: QuestionDetailViewProps) => {
  if (!question) return null;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getBloomLevelColor = (bloomLevel: string) => {
    switch (bloomLevel) {
      case 'remember': return 'bg-blue-100 text-blue-800';
      case 'understand': return 'bg-indigo-100 text-indigo-800';
      case 'apply': return 'bg-purple-100 text-purple-800';
      case 'analyze': return 'bg-pink-100 text-pink-800';
      case 'evaluate': return 'bg-orange-100 text-orange-800';
      case 'create': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <Card className="border-0 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center space-x-3">
              <CardTitle className="text-xl">Q{question.id}</CardTitle>
              <Badge className={getDifficultyColor(question.difficulty)}>
                {question.difficulty}
              </Badge>
              <Badge className={getBloomLevelColor(question.bloomLevel)}>
                {question.bloomLevel}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Question Content */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Question</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-900 whitespace-pre-wrap">
                  {question.content}
                </p>
              </div>
            </div>

            {/* Answer Section */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Answer</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-600 italic">
                  Answer will be displayed here when available.
                </p>
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Created:</span>
                <p>{new Date(question.createdAt).toLocaleDateString()}</p>
              </div>
              {question.class && (
                <div>
                  <span className="font-medium">Course:</span>
                  <p>{question.class.name}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => onEdit(question)}
                className="flex items-center space-x-2"
              >
                <Edit className="h-4 w-4" />
                <span>Edit</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => onCreateVariant(question)}
                className="flex items-center space-x-2"
              >
                <Copy className="h-4 w-4" />
                <span>Variant</span>
              </Button>
              <Button
                variant="destructive"
                onClick={() => onDelete(question)}
                className="flex items-center space-x-2"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
