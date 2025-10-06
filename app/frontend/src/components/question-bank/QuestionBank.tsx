import { useState, useMemo } from 'react';
import { Question } from '../../types/question';
import { QuestionCard } from './QuestionCard';
import { SearchAndFilters } from './SearchAndFilters';
import { QuestionBankHeader } from './QuestionBankHeader';

interface QuestionBankProps {
  questions: Question[];
  onViewQuestion: (question: Question) => void;
  onCreateVariant: (question: Question) => void;
  onAddQuestion: () => void;
  onUploadQuestions: () => void;
}

export const QuestionBank = ({
  questions,
  onViewQuestion,
  onCreateVariant,
  onAddQuestion,
  onUploadQuestions
}: QuestionBankProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Filter and sort questions
  const filteredQuestions = useMemo(() => {
    let filtered = [...questions];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(q =>
        q.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply difficulty filter
    if (difficultyFilter !== 'all') {
      filtered = filtered.filter(q => q.difficulty === difficultyFilter);
    }

    // Apply sorting
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'difficulty':
        const difficultyOrder = { easy: 0, medium: 1, hard: 2 };
        filtered.sort((a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]);
        break;
    }

    return filtered;
  }, [questions, searchTerm, difficultyFilter, sortBy]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <QuestionBankHeader
        questionCount={filteredQuestions.length}
        difficultyFilter={difficultyFilter}
        onAddQuestion={onAddQuestion}
        onUploadQuestions={onUploadQuestions}
      />

      {/* Search and Filters */}
      <SearchAndFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        difficultyFilter={difficultyFilter}
        onDifficultyChange={setDifficultyFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* Questions List */}
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
            <p className="text-gray-500">No questions found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
};
