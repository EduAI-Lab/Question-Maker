import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { X, Edit, Copy, Trash2 } from 'lucide-react';
import { QuestionVariantEntry } from '../../types/question';

interface QuestionDetailViewProps {
  entry: QuestionVariantEntry;
  onClose: () => void;
  onEdit: (entry: QuestionVariantEntry) => void;
  onCreateVariant: (entry: QuestionVariantEntry) => void;
  onDeleteVariant: (entry: QuestionVariantEntry) => void;
}

export const QuestionDetailView = ({
  entry,
  onClose,
  onEdit,
  onCreateVariant,
  onDeleteVariant
}: QuestionDetailViewProps) => {
  const { variant } = entry;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <Card className="border-0 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center space-x-3">
              <CardTitle className="text-xl">Variant #{variant.id}</CardTitle>
              <Badge variant="secondary" className="uppercase">{entry.questionType}</Badge>
              <Badge variant="outline" className="capitalize">{variant.difficulty ?? 'medium'}</Badge>
              {entry.courseName && <Badge variant="outline">{entry.courseName}</Badge>}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Question Text</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-900 whitespace-pre-wrap">{variant.questionText}</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Question Metadata</h3>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm text-gray-700">
                <p>
                  <span className="font-medium">Base Question Description:</span>{' '}
                  {entry.questionDescription}
                </p>
                <p>
                  <span className="font-medium">Primary Topic ID:</span>{' '}
                  {entry.primaryTopicId}
                </p>
                <p>
                  <span className="font-medium">Course:</span>{' '}
                  {entry.courseName || 'Unassigned'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Created:</span>
                <p>{new Date(variant.createdAt || variant.updatedAt || new Date().toISOString()).toLocaleString()}</p>
              </div>
              <div>
                <span className="font-medium">Assessment:</span>
                <p>{variant.assessmentId ?? 'Not linked'}</p>
              </div>
              <div>
                <span className="font-medium">Secondary Topics:</span>
                <p>
                  {variant.secondaryTopicsId && variant.secondaryTopicsId.length > 0
                    ? variant.secondaryTopicsId.join(', ')
                    : 'None'}
                </p>
              </div>
              <div>
                <span className="font-medium">Reference Variant:</span>
                <p>{variant.referenceId ?? 'None'}</p>
              </div>
            </div>

            {variant.answer && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Answer</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-wrap">{variant.answer}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button variant="outline" onClick={() => onEdit(entry)} className="flex items-center space-x-2">
                <Edit className="h-4 w-4" />
                <span>Edit</span>
              </Button>
              <Button variant="outline" onClick={() => onCreateVariant(entry)} className="flex items-center space-x-2">
                <Copy className="h-4 w-4" />
                <span>Variant</span>
              </Button>
              <Button variant="destructive" onClick={() => onDeleteVariant(entry)} className="flex items-center space-x-2">
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
