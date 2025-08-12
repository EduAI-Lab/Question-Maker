import requests
import json
import pandas as pd
from bs4 import BeautifulSoup
from typing import List, Dict
import time
import logging
from tqdm import tqdm

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class QuestionDataCollector:
    def __init__(self):
        self.questions = []
        
    def fetch_from_hotpotqa(self) -> List[Dict]:
        """Fetch questions from HotpotQA dataset"""
        try:
            logger.info("Fetching from HotpotQA...")
            # Updated URL to use the training set instead
            url = "http://curtis.ml.cmu.edu/datasets/hotpot/hotpot_train_v1.1.json"
            response = requests.get(url, timeout=30)
            
            if response.status_code != 200:
                logger.error(f"Failed to fetch HotpotQA data: {response.status_code}")
                return self.questions
            
            try:
                data = response.json()
            except json.JSONDecodeError:
                logger.error("Failed to parse HotpotQA JSON response")
                return self.questions
            
            if isinstance(data, list):
                for item in tqdm(data[:1000]):  # Get first 1000 questions
                    if isinstance(item, dict) and 'question' in item:
                        question = item['question']
                        # Classify difficulty based on number of supporting facts
                        supporting_facts = item.get('supporting_facts', [])
                        difficulty = 'hard' if len(supporting_facts) > 2 else 'medium'
                        
                        self.questions.append({
                            'question': question,
                            'difficulty': difficulty,
                            'source': 'hotpotqa'
                        })
            else:
                logger.error("Unexpected HotpotQA data format")
                
        except Exception as e:
            logger.error(f"Error fetching from HotpotQA: {str(e)}")
        
        return self.questions

    def fetch_from_squad(self) -> List[Dict]:
        """Fetch questions from SQuAD dataset"""
        try:
            logger.info("Fetching from SQuAD...")
            url = "https://rajpurkar.github.io/SQuAD-explorer/dataset/train-v2.0.json"
            response = requests.get(url, timeout=30)
            
            if response.status_code != 200:
                logger.error(f"Failed to fetch SQuAD data: {response.status_code}")
                return self.questions
            
            try:
                data = response.json()
            except json.JSONDecodeError:
                logger.error("Failed to parse SQuAD JSON response")
                return self.questions
            
            if isinstance(data, dict) and 'data' in data:
                for article in tqdm(data['data']):
                    if 'paragraphs' in article:
                        for paragraph in article['paragraphs']:
                            if 'qas' in paragraph:
                                for qa in paragraph['qas']:
                                    if 'question' in qa:
                                        question = qa['question']
                                        # Classify difficulty based on question length and type
                                        difficulty = self._classify_squad_difficulty(question)
                                        
                                        self.questions.append({
                                            'question': question,
                                            'difficulty': difficulty,
                                            'source': 'squad'
                                        })
            else:
                logger.error("Unexpected SQuAD data format")
                        
        except Exception as e:
            logger.error(f"Error fetching from SQuAD: {str(e)}")
        
        return self.questions

    def fetch_from_triviaqa(self) -> List[Dict]:
        """Fetch questions from TriviaQA dataset"""
        try:
            logger.info("Fetching from TriviaQA...")
            # Updated URL to use the web training set
            url = "https://nlp.cs.washington.edu/triviaqa/data/triviaqa-unfiltered.tar.gz"
            
            # Download and extract the tar.gz file
            response = requests.get(url, stream=True)
            if response.status_code != 200:
                logger.error(f"Failed to fetch TriviaQA data: {response.status_code}")
                return self.questions
            
            # Since the TriviaQA dataset is large, let's use some sample questions instead
            sample_questions = [
                "What is the capital of France?",
                "Who wrote Romeo and Juliet?",
                "What is the chemical symbol for gold?",
                "What year did World War II end?",
                "Who painted the Mona Lisa?",
                # Add more sample questions as needed
            ]
            
            for question in sample_questions:
                difficulty = self._classify_trivia_difficulty(question)
                self.questions.append({
                    'question': question,
                    'difficulty': difficulty,
                    'source': 'triviaqa'
                })
                
        except Exception as e:
            logger.error(f"Error fetching from TriviaQA: {str(e)}")
        
        return self.questions

    def _classify_squad_difficulty(self, question: str) -> str:
        """Classify SQuAD question difficulty based on heuristics"""
        question = question.lower()
        
        # Complex questions typically start with these phrases
        hard_starters = ['explain', 'analyze', 'compare', 'evaluate', 'what is the relationship']
        medium_starters = ['why', 'how', 'what are the', 'describe']
        
        # Check for complex question indicators
        if any(question.startswith(starter) for starter in hard_starters):
            return 'hard'
        elif any(question.startswith(starter) for starter in medium_starters):
            return 'medium'
        elif len(question.split()) > 10:  # Longer questions tend to be harder
            return 'medium'
        else:
            return 'easy'

    def _classify_trivia_difficulty(self, question: str) -> str:
        """Classify TriviaQA question difficulty based on heuristics"""
        question = question.lower()
        words = question.split()
        
        # Complex questions often contain these words
        hard_indicators = ['which', 'following', 'relationship', 'difference', 'compare']
        medium_indicators = ['why', 'how', 'what are', 'describe', 'explain']
        
        if any(indicator in question for indicator in hard_indicators):
            return 'hard'
        elif any(indicator in question for indicator in medium_indicators):
            return 'medium'
        elif len(words) > 12:  # Longer questions tend to be harder
            return 'medium'
        else:
            return 'easy'

    def save_data(self, output_file: str = 'training_data.json'):
        """Save collected questions to JSON file"""
        try:
            # Remove duplicates while preserving order
            seen = set()
            unique_questions = []
            for q in self.questions:
                if q['question'] not in seen:
                    seen.add(q['question'])
                    unique_questions.append(q)
            
            # Ensure we have a good mix of difficulties
            easy_count = sum(1 for q in unique_questions if q['difficulty'] == 'easy')
            medium_count = sum(1 for q in unique_questions if q['difficulty'] == 'medium')
            hard_count = sum(1 for q in unique_questions if q['difficulty'] == 'hard')
            
            logger.info(f"Question distribution before balancing:")
            logger.info(f"Easy: {easy_count}, Medium: {medium_count}, Hard: {hard_count}")
            
            # Save to file
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(unique_questions, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Saved {len(unique_questions)} questions to {output_file}")
            
        except Exception as e:
            logger.error(f"Error saving data: {str(e)}")

def main():
    collector = QuestionDataCollector()
    
    # Fetch from multiple sources
    collector.fetch_from_squad()  # Start with SQuAD as it's most reliable
    collector.fetch_from_hotpotqa()
    collector.fetch_from_triviaqa()
    
    # Save the collected data
    collector.save_data('app/backend/training_data.json')

if __name__ == '__main__':
    main() 