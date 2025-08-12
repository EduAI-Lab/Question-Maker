import React from 'react';
import { Box, Text, Badge, Flex } from '@chakra-ui/react';

interface QuestionCardProps {
  content: string;
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: string;
}

const difficultyColors = {
  easy: 'green',
  medium: 'yellow',
  hard: 'red'
};

const QuestionCard: React.FC<QuestionCardProps> = ({ content, difficulty, createdAt }) => {
  return (
    <Box
      borderWidth="1px"
      borderRadius="lg"
      p={4}
      mb={4}
      position="relative"
    >
      <Flex justify="space-between" align="center" mb={2}>
        <Text fontSize="lg" fontWeight="medium">
          {content}
        </Text>
        <Badge
          colorScheme={difficultyColors[difficulty]}
          position="absolute"
          top={2}
          right={2}
          px={2}
          py={1}
          borderRadius="full"
          textTransform="capitalize"
        >
          {difficulty}
        </Badge>
      </Flex>
      <Text fontSize="sm" color="gray.500">
        Created: {new Date(createdAt).toLocaleDateString()}
      </Text>
    </Box>
  );
};

export default QuestionCard; 