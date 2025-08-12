import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from transformers import ElectraModel, ElectraTokenizer
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import json
import os
from typing import List, Dict, Tuple
import logging
from tqdm import tqdm

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class QuestionDataset(Dataset):
    def __init__(self, questions: List[str], labels: List[int], tokenizer):
        self.questions = questions
        self.labels = labels
        self.tokenizer = tokenizer
    
    def __len__(self):
        return len(self.questions)
    
    def __getitem__(self, idx):
        question = self.questions[idx]
        label = self.labels[idx]
        
        # Tokenize question
        encoding = self.tokenizer(
            question,
            truncation=True,
            max_length=512,
            padding='max_length',
            return_tensors='pt'
        )
        
        return {
            'input_ids': encoding['input_ids'].squeeze(),
            'attention_mask': encoding['attention_mask'].squeeze(),
            'label': torch.tensor(label)
        }

class QuestionClassifierModel(nn.Module):
    def __init__(self, electra_model: str = 'google/electra-base-discriminator'):
        super().__init__()
        self.electra = ElectraModel.from_pretrained(electra_model)
        self.lstm = nn.LSTM(
            input_size=768,
            hidden_size=256,
            num_layers=2,
            bidirectional=True,
            batch_first=True
        )
        self.dropout = nn.Dropout(0.2)
        self.fc = nn.Linear(512, 3)  # 3 classes: easy, medium, hard
    
    def forward(self, input_ids, attention_mask):
        # Get ELECTRA embeddings
        electra_output = self.electra(
            input_ids=input_ids,
            attention_mask=attention_mask
        )
        embeddings = electra_output.last_hidden_state
        
        # Pass through LSTM
        lstm_out, _ = self.lstm(embeddings)
        
        # Get final hidden state
        final_hidden = lstm_out[:, -1, :]
        
        # Apply dropout and classification layer
        final_hidden = self.dropout(final_hidden)
        logits = self.fc(final_hidden)
        
        return logits

def train_model(
    model: QuestionClassifierModel,
    train_loader: DataLoader,
    val_loader: DataLoader,
    num_epochs: int = 10,
    learning_rate: float = 2e-5,
    device: str = 'cuda' if torch.cuda.is_available() else 'cpu'
) -> Tuple[List[float], List[float], Dict]:
    
    logger.info(f"Training on device: {device}")
    model = model.to(device)
    optimizer = optim.AdamW(model.parameters(), lr=learning_rate)
    criterion = nn.CrossEntropyLoss()
    
    train_losses = []
    val_losses = []
    best_val_loss = float('inf')
    best_metrics = {}
    
    for epoch in range(num_epochs):
        # Training phase
        model.train()
        total_train_loss = 0
        train_preds = []
        train_labels = []
        
        for batch in tqdm(train_loader, desc=f"Epoch {epoch+1}/{num_epochs} - Training"):
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            labels = batch['label'].to(device)
            
            optimizer.zero_grad()
            outputs = model(input_ids, attention_mask)
            loss = criterion(outputs, labels)
            
            loss.backward()
            optimizer.step()
            
            total_train_loss += loss.item()
            
            # Store predictions
            preds = torch.argmax(outputs, dim=1)
            train_preds.extend(preds.cpu().numpy())
            train_labels.extend(labels.cpu().numpy())
        
        avg_train_loss = total_train_loss / len(train_loader)
        train_losses.append(avg_train_loss)
        
        # Validation phase
        model.eval()
        total_val_loss = 0
        val_preds = []
        val_labels = []
        
        with torch.no_grad():
            for batch in tqdm(val_loader, desc="Validation"):
                input_ids = batch['input_ids'].to(device)
                attention_mask = batch['attention_mask'].to(device)
                labels = batch['label'].to(device)
                
                outputs = model(input_ids, attention_mask)
                loss = criterion(outputs, labels)
                
                total_val_loss += loss.item()
                
                # Store predictions
                preds = torch.argmax(outputs, dim=1)
                val_preds.extend(preds.cpu().numpy())
                val_labels.extend(labels.cpu().numpy())
        
        avg_val_loss = total_val_loss / len(val_loader)
        val_losses.append(avg_val_loss)
        
        # Calculate metrics
        train_report = classification_report(train_labels, train_preds, output_dict=True)
        val_report = classification_report(val_labels, val_preds, output_dict=True)
        
        logger.info(f"Epoch {epoch+1}/{num_epochs}:")
        logger.info(f"Average training loss: {avg_train_loss:.4f}")
        logger.info(f"Average validation loss: {avg_val_loss:.4f}")
        logger.info(f"Validation Metrics:\n{classification_report(val_labels, val_preds)}")
        
        # Save best model
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            best_metrics = {
                'val_report': val_report,
                'confusion_matrix': confusion_matrix(val_labels, val_preds)
            }
            torch.save(model.state_dict(), 'best_model.pth')
    
    return train_losses, val_losses, best_metrics

def save_model(model: QuestionClassifierModel, save_path: str):
    """Save the trained model"""
    torch.save(model.state_dict(), save_path)
    logger.info(f"Model saved to {save_path}")

def load_training_data(data_path: str) -> Tuple[List[str], List[int]]:
    """Load and preprocess training data"""
    try:
        with open(data_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        questions = []
        labels = []
        
        difficulty_map = {
            'easy': 0,
            'medium': 1,
            'hard': 2
        }
        
        for item in data:
            questions.append(item['question'])
            labels.append(difficulty_map[item['difficulty']])
        
        logger.info(f"Loaded {len(questions)} questions from {data_path}")
        return questions, labels
            
    except FileNotFoundError:
        raise FileNotFoundError(f"Training data file not found at: {data_path}")
    except json.JSONDecodeError:
        raise ValueError("Invalid JSON format in training data file")

def main():
    # Set random seed for reproducibility
    torch.manual_seed(42)
    
    # Load training data
    questions, labels = load_training_data('app/backend/training_data.json')
    
    # Take a smaller subset for faster training
    max_samples = 10000  # Limit to 10k samples for faster training
    if len(questions) > max_samples:
        indices = np.random.choice(len(questions), max_samples, replace=False)
        questions = [questions[i] for i in indices]
        labels = [labels[i] for i in indices]
    
    # Split data
    X_train, X_val, y_train, y_val = train_test_split(
        questions, labels, test_size=0.2, random_state=42, stratify=labels
    )
    
    logger.info(f"Training set size: {len(X_train)}")
    logger.info(f"Validation set size: {len(X_val)}")
    
    # Initialize tokenizer and create datasets
    tokenizer = ElectraTokenizer.from_pretrained('google/electra-base-discriminator')
    train_dataset = QuestionDataset(X_train, y_train, tokenizer)
    val_dataset = QuestionDataset(X_val, y_val, tokenizer)
    
    # Create data loaders with smaller batch size
    train_loader = DataLoader(train_dataset, batch_size=8, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=8)
    
    # Initialize and train model
    model = QuestionClassifierModel()
    train_losses, val_losses, best_metrics = train_model(
        model, 
        train_loader, 
        val_loader,
        num_epochs=5  # Reduced number of epochs
    )
    
    # Save the final model
    save_model(model, 'app/backend/question_classifier.pth')
    
    # Save metrics
    with open('app/backend/training_metrics.json', 'w') as f:
        json.dump({
            'train_losses': train_losses,
            'val_losses': val_losses,
            'best_metrics': best_metrics
        }, f, indent=2)
    
    logger.info("Training completed successfully!")

if __name__ == '__main__':
    main() 