import { useState, useMemo } from 'react';
import { QuestionVariantEntry } from '../../types/question';
import { QuestionCard } from './QuestionCard';
import { SearchAndFilters } from './SearchAndFilters';
import { QuestionBankHeader } from './QuestionBankHeader';
import { Loader2 } from 'lucide-react';

interface QuestionBankProps {
  variants: QuestionVariantEntry[];
  onViewVariant: (entry: QuestionVariantEntry) => void;
  onCreateVariant: (entry: QuestionVariantEntry) => void;
  onAddQuestion: () => void;
  onUploadQuestions: () => void;
  isLoading?: boolean;
  courseName?: string;
  emptyMessage?: string;
  disableAdd?: boolean;
  disableUpload?: boolean;
}

export const QuestionBank = ({
  variants,
  onViewVariant,
  onCreateVariant,
  onAddQuestion,
  onUploadQuestions,
  isLoading = false,
  courseName,
  emptyMessage,
  disableAdd = false,
  disableUpload = false
}: QuestionBankProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'type'>('newest');

  const filteredVariants = useMemo(() => {
    let filtered = [...variants];

    if (searchTerm) {
      const lowered = searchTerm.toLowerCase();
      filtered = filtered.filter((entry) =>
        entry.variant.questionText.toLowerCase().includes(lowered) ||
        entry.questionDescription.toLowerCase().includes(lowered)
      );
    }

    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) =>
          new Date(b.variant.createdAt || b.variant.updatedAt || b.variant.id).getTime() -
          new Date(a.variant.createdAt || a.variant.updatedAt || a.variant.id).getTime()
        );
        break;
      case 'oldest':
        filtered.sort((a, b) =>
          new Date(a.variant.createdAt || a.variant.updatedAt || a.variant.id).getTime() -
          new Date(b.variant.createdAt || b.variant.updatedAt || b.variant.id).getTime()
        );
        break;
      case 'type':
        filtered.sort((a, b) => a.questionType.localeCompare(b.questionType));
        break;
    }

    return filtered;
  }, [variants, searchTerm, sortBy]);

  return (
    <div className="space-y-6">
      <QuestionBankHeader
        questionCount={filteredVariants.length}
        courseName={courseName}
        onAddQuestion={onAddQuestion}
        onUploadQuestions={onUploadQuestions}
        disableAdd={disableAdd}
        disableUpload={disableUpload}
      />

      <SearchAndFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sortBy={sortBy}
        onSortChange={(value) => setSortBy(value)}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading questions...
        </div>
      ) : (
        <div className="space-y-3">
          {filteredVariants.map((entry, index) => (
            <QuestionCard
              key={`${entry.questionId}-${entry.variant.id}`}
              entry={entry}
              questionNumber={index + 1}
              onView={onViewVariant}
              onCreateVariant={onCreateVariant}
            />
          ))}

          {filteredVariants.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">{emptyMessage || 'No variants available for this course yet.'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
