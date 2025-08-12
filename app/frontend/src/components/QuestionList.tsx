import React, { useState, useMemo, useEffect } from 'react';
import {
  VStack,
  HStack,
  Heading,
  Text,
  Select,
  Box,
  Stat,
  StatLabel,
  StatNumber,
  StatGroup,
  Badge,
  Flex
} from '@chakra-ui/react';
import QuestionCard from './QuestionCard';

interface Question {
  id: number;
  content: string;
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: string;
}

interface QuestionListProps {
  questions: Question[];
}

// Constants for localStorage keys
const DIFFICULTY_FILTER_KEY = 'questionList_difficultyFilter';
const SORT_BY_KEY = 'questionList_sortBy';

const QuestionList: React.FC<QuestionListProps> = ({ questions }) => {
  // Initialize state with values from localStorage or defaults
  const [difficultyFilter, setDifficultyFilter] = useState<string>(() => {
    const saved = localStorage.getItem(DIFFICULTY_FILTER_KEY);
    return saved || 'all';
  });
  
  const [sortBy, setSortBy] = useState<string>(() => {
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

  // Handle filter change
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDifficultyFilter(e.target.value);
  };

  // Handle sort change
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value);
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const total = questions.length;
    const easyCount = questions.filter(q => q.difficulty === 'easy').length;
    const mediumCount = questions.filter(q => q.difficulty === 'medium').length;
    const hardCount = questions.filter(q => q.difficulty === 'hard').length;

    return {
      total,
      easy: easyCount,
      medium: mediumCount,
      hard: hardCount,
      easyPercent: total ? Math.round((easyCount / total) * 100) : 0,
      mediumPercent: total ? Math.round((mediumCount / total) * 100) : 0,
      hardPercent: total ? Math.round((hardCount / total) * 100) : 0
    };
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
      <Text color="gray.500" textAlign="center" mt={4}>
        No questions available
      </Text>
    );
  }

  return (
    <VStack spacing={6} align="stretch" width="100%">
      {/* Statistics Section */}
      <Box borderWidth="1px" borderRadius="lg" p={4} bg="white">
        <Heading size="sm" mb={4}>Question Statistics</Heading>
        <StatGroup>
          <Stat>
            <StatLabel>Total Questions</StatLabel>
            <StatNumber>{stats.total}</StatNumber>
          </Stat>
          <Stat>
            <StatLabel>Easy</StatLabel>
            <StatNumber color="green.500">{stats.easyPercent}%</StatNumber>
            <Text fontSize="sm">({stats.easy} questions)</Text>
          </Stat>
          <Stat>
            <StatLabel>Medium</StatLabel>
            <StatNumber color="yellow.500">{stats.mediumPercent}%</StatNumber>
            <Text fontSize="sm">({stats.medium} questions)</Text>
          </Stat>
          <Stat>
            <StatLabel>Hard</StatLabel>
            <StatNumber color="red.500">{stats.hardPercent}%</StatNumber>
            <Text fontSize="sm">({stats.hard} questions)</Text>
          </Stat>
        </StatGroup>
      </Box>

      {/* Filters and Sorting */}
      <HStack spacing={4} justify="space-between">
        <Box>
          <Select
            value={difficultyFilter}
            onChange={handleFilterChange}
            width="200px"
          >
            <option value="all">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </Select>
        </Box>
        <Box>
          <Select
            value={sortBy}
            onChange={handleSortChange}
            width="200px"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="easiest">Easiest First</option>
            <option value="hardest">Hardest First</option>
          </Select>
        </Box>
      </HStack>

      {/* Questions List */}
      <VStack spacing={4} align="stretch">
        <Flex justify="space-between" align="center">
          <Heading size="md">Your Questions</Heading>
          <Text color="gray.500" fontSize="sm">
            Showing {filteredAndSortedQuestions.length} of {questions.length} questions
          </Text>
        </Flex>
        {filteredAndSortedQuestions.map((question) => (
          <QuestionCard
            key={question.id}
            content={question.content}
            difficulty={question.difficulty}
            createdAt={question.createdAt}
          />
        ))}
      </VStack>
    </VStack>
  );
};

export default QuestionList; 