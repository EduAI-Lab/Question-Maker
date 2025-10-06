import { useState, useMemo } from 'react';
import { Question } from '../../types/question';
import { QuestionCard } from './QuestionCard';
import { SearchAndFilters } from './SearchAndFilters';
import { QuestionBankHeader } from './QuestionBankHeader';
import { Loader2 } from 'lucide-react';

interface QuestionBankProps {
  questions: Question[];
  onViewQuestion: (question: Question) => void;
  onCreateVariant: (question: Question) => void;
  onAddQuestion: () => void;
  onUploadQuestions: () => void;
  isLoading?: boolean;
  courseName?: string;
  emptyMessage?: string;
}

export const QuestionBank = ({
  questions,
  onViewQuestion,
  onCreateVariant,
  onAddQuestion,
  onUploadQuestions,
  isLoading = false,
  courseName,
  emptyMessage
}: QuestionBankProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'type'>('newest');

  // Filter and sort questions
  const filteredQuestions = useMemo(() => {
    let filtered = [...questions];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(q =>
        (q.description || q.content || '')
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'type':
        filtered.sort((a, b) => a.type.localeCompare(b.type));
        break;
    }

    return filtered;
  }, [questions, searchTerm, sortBy]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <QuestionBankHeader
        questionCount={filteredQuestions.length}
        courseName={courseName}
        onAddQuestion={onAddQuestion}
        onUploadQuestions={onUploadQuestions}
      />

      {/* Search and Filters */}
      <SearchAndFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sortBy={sortBy}
        onSortChange={(value) => setSortBy(value)}
      />

      {/* Questions List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading questions...
        </div>
      ) : (
      <div className="space-y-3">
        {filteredQuestions.map((question, index) => (
          <QuestionCard
            key={question.id}
            question={question}
            questionNumber={index + 1}
            onViewQuestion={onViewQuestion}
            onCreateVariant={onCreateVariant}
          />
        ))}

        {filteredQuestions.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">{emptyMessage || 'No questions available for this course yet.'}</p>
          </div>
        )}
      </div>
      )}
    </div>
  );
};
