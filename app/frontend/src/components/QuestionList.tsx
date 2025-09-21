import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import QuestionCard from './QuestionCard';

interface Question {
  id: number;
  content: string;
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: string;
  tags?: string[];
}

interface QuestionListProps {
  questions: Question[];
  onDelete?: (id: number) => void;
}

const DIFFICULTY_FILTER_KEY = 'question-difficulty-filter';
const SORT_BY_KEY = 'question-sort-by';

const QuestionList = ({ questions }: QuestionListProps) => {
  const [difficultyFilter, setDifficultyFilter] = useState(() => {
    const saved = localStorage.getItem(DIFFICULTY_FILTER_KEY);
    return saved || 'all';
  });

  const [sortBy, setSortBy] = useState(() => {
    const saved = localStorage.getItem(SORT_BY_KEY);
    return saved || 'newest';
  });

  // Save preferences to localStorage when they change
  useEffect(() => {
    localStorage.setItem(DIFFICULTY_FILTER_KEY, difficultyFilter);
  }, [difficultyFilter]);

  useEffect(() => {
    localStorage.setItem(SORT_BY_KEY, sortBy);
  }, [sortBy]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = questions.length;
    const easyCount = questions.filter(q => q.difficulty === 'easy').length;
    const mediumCount = questions.filter(q => q.difficulty === 'medium').length;
    const hardCount = questions.filter(q => q.difficulty === 'hard').length;

    return { total, easyCount, mediumCount, hardCount };
  }, [questions]);

  // Filter and sort questions
  const filteredAndSortedQuestions = useMemo(() => {
    let filtered = [...questions];
    
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
      case 'easiest':
        const difficultyOrder = { easy: 0, medium: 1, hard: 2 };
        filtered.sort((a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]);
        break;
      case 'hardest':
        const difficultyOrderReverse = { easy: 2, medium: 1, hard: 0 };
        filtered.sort((a, b) => difficultyOrderReverse[a.difficulty] - difficultyOrderReverse[b.difficulty]);
        break;
    }
    
    return filtered;
  }, [questions, difficultyFilter, sortBy]);

  if (!questions.length) {
    return (
      <p className="text-gray-500 text-center mt-4">
        No questions available
      </p>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Statistics Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Question Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Total Questions</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Easy</p>
              <p className="text-2xl font-bold text-green-600">{stats.easyCount}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Medium</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.mediumCount}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Hard</p>
              <p className="text-2xl font-bold text-red-600">{stats.hardCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Sorting */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters & Sorting</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Filter by Difficulty</label>
              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All difficulties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Difficulties</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Sort by</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="easiest">Easiest First</SelectItem>
                  <SelectItem value="hardest">Hardest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            Questions ({filteredAndSortedQuestions.length})
          </h3>
          {difficultyFilter !== 'all' && (
            <Badge variant="secondary">
              Filtered by: {difficultyFilter}
            </Badge>
          )}
        </div>
        
        <div className="space-y-4">
          {filteredAndSortedQuestions.map((question) => (
            <QuestionCard
              key={question.id}
              content={question.content}
              difficulty={question.difficulty}
              createdAt={question.createdAt}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuestionList;