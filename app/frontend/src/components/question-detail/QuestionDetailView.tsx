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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <Card className="border-0 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center space-x-3">
              <CardTitle className="text-xl">Q{question.id}</CardTitle>
              <Badge variant="secondary" className="uppercase">
                {question.type}
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
                  {question.description || question.content || 'No description provided.'}
                </p>
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Created:</span>
                <p>{new Date(question.createdAt).toLocaleDateString()}</p>
              </div>
              {question.course && (
                <div>
                  <span className="font-medium">Course:</span>
                  <p>{question.course.name}</p>
                </div>
              )}
              <div>
                <span className="font-medium">Primary Topic ID:</span>
                <p>{question.primaryTopicId}</p>
              </div>
            </div>

            {/* Variants */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Variants</h3>
              {question.variants && question.variants.length > 0 ? (
                <div className="space-y-3">
                  {question.variants.map((variant) => (
                    <div key={variant.id} className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex justify-between items-center mb-2 text-sm text-gray-600">
                        <span>Variant #{variant.id}</span>
                        <Badge variant="outline" className="capitalize">
                          {variant.difficulty ?? 'unknown'}
                        </Badge>
                      </div>
                      <p className="text-gray-900 whitespace-pre-wrap">{variant.questionText}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No variants created yet.</p>
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
