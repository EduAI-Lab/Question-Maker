from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Security, logger, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Tuple
import jwt
from passlib.context import CryptContext
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import requests
import tempfile
import asyncio
import re
import hashlib
import io
import csv
import json
from difflib import SequenceMatcher
from enum import Enum
from fastapi.responses import JSONResponse, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from tenacity import retry, stop_after_attempt, wait_exponential

# Optional imports with error handling
try:
    import docx
except ImportError:
    docx = None
    print("Warning: python-docx not available")

try:
    import pdfplumber
except ImportError:
    pdfplumber = None
    print("Warning: pdfplumber not available")

try:
    import pdf2image
    from pdf2image import convert_from_bytes
except ImportError:
    pdf2image = None
    convert_from_bytes = None
    print("Warning: pdf2image not available")

try:
    import pytesseract
except ImportError:
    pytesseract = None
    print("Warning: pytesseract not available")

try:
    import pdfminer.high_level
except ImportError:
    pdfminer = None
    print("Warning: pdfminer not available")

try:
    from tika import parser
    import tika
except ImportError:
    parser = None
    tika = None
    print("Warning: tika not available")

try:
    from minio.error import S3Error
    from minio import Minio
except ImportError:
    S3Error = None
    Minio = None
    print("Warning: minio not available")

try:
    import PyPDF2
except ImportError:
    PyPDF2 = None
    print("Warning: PyPDF2 not available")

try:
    import numpy as np
except ImportError:
    np = None
    print("Warning: numpy not available")

try:
    from huggingface_hub import InferenceClient
except ImportError:
    InferenceClient = None
    print("Warning: huggingface_hub not available")

try:
    from groq import Groq
except ImportError:
    Groq = None
    print("Warning: groq not available")

try:
    import torch
    import torch.nn as nn
    from transformers import ElectraModel, ElectraTokenizer, pipeline
except ImportError:
    torch = None
    nn = None
    ElectraModel = None
    ElectraTokenizer = None
    pipeline = None
    print("Warning: torch/transformers not available")

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None
    print("Warning: openai not available")

# Local imports
try:
    from utils.file_processor import FileProcessor
except ImportError:
    FileProcessor = None
    print("Warning: FileProcessor not available")

try:
    from models import Class, Draft
except ImportError:
    Class = None
    Draft = None
    print("Warning: models not available")

load_dotenv()

# Database setup
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Security
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# Initialize MinIO client
minio_client = None
if Minio:
    try:
        minio_client = Minio(
            os.getenv("MINIO_ENDPOINT"),
            access_key=os.getenv("MINIO_ACCESS_KEY"),
            secret_key=os.getenv("MINIO_SECRET_KEY"),
            secure=False
        )
    except Exception as e:
        print(f"Warning: Failed to initialize MinIO client: {e}")
        minio_client = None

# Initialize Groq client
groq_client = None
if Groq:
    try:
        groq_client = Groq(
            api_key=os.environ.get("GROQ_API_KEY", "")
        )
    except Exception as e:
        print(f"Warning: Failed to initialize Groq client: {e}")
        groq_client = None

# Initialize OpenAI client
openai_client = None
if OpenAI:
    try:
        openai_client = OpenAI(
            api_key=os.environ.get("OPENAI_API_KEY", "")
        )
    except Exception as e:
        print(f"Warning: Failed to initialize OpenAI client: {e}")
        openai_client = None

# Add DeepSeek API key
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")

MODEL_ID = "llama-3.3-70b-versatile"
MAX_CHUNK_SIZE = 8000

# Add model provider enum
class ModelProvider(str, Enum):
    GROQ = "groq"
    DEEPSEEK = "deepseek"
    OPENAI = "openai"

# Add QuestionDifficulty enum
class QuestionDifficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"

class BloomLevel(str, Enum):
    REMEMBER = "remember"
    UNDERSTAND = "understand"
    APPLY = "apply"
    ANALYZE = "analyze"
    EVALUATE = "evaluate"
    CREATE = "create"

class QuestionGenerationParams(BaseModel):
    prompt: str
    provider: ModelProvider = ModelProvider.GROQ
    num_questions: int = 15
    difficulty_distribution: Dict[str, int] = {
        "easy": 5,
        "medium": 5,
        "hard": 5
    }

# Update Question model
class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    content = Column(String)
    difficulty = Column(String, default=QuestionDifficulty.MEDIUM)
    bloom_level = Column(String, default=BloomLevel.UNDERSTAND)
    created_at = Column(DateTime, default=datetime.utcnow)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=True)

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
async def call_groq_api(prompt: str, params: QuestionGenerationParams) -> str:
    """Call Groq API with user-specified parameters"""
    try:
        if groq_client is None:
            raise Exception("Groq client not available")
            
        chat_completion = await asyncio.to_thread(
            groq_client.chat.completions.create,
            messages=[
                {
                    "role": "system",
                    "content": f"""You are a question generation assistant. Generate exactly {params.num_questions} high-quality questions with the following distribution:
                    - Easy: {params.difficulty_distribution['easy']} questions
                    - Medium: {params.difficulty_distribution['medium']} questions
                    - Hard: {params.difficulty_distribution['hard']} questions

                    For each question:
                    1. Classify its difficulty (easy/medium/hard)
                    2. Classify its Bloom's Taxonomy level (remember/understand/apply/analyze/evaluate/create)
                    3. Format each question as a JSON object
                    
                    IMPORTANT: Your response must be ONLY a valid JSON array of question objects. Do not include any other text.
                    Each object must have this exact format:
                    {{
                        "content": "The question text",
                        "difficulty": "easy/medium/hard",
                        "bloom_level": "remember/understand/apply/analyze/evaluate/create"
                    }}"""
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            model=MODEL_ID,
            temperature=0.7,
            max_tokens=2000,
            top_p=0.9,
            stream=False
        )
        
        if chat_completion and chat_completion.choices:
            response_text = chat_completion.choices[0].message.content.strip()
            
            # Try to parse as JSON
            try:
                questions_data = json.loads(response_text)
                if isinstance(questions_data, list):
                    return json.dumps(questions_data)  # Return properly formatted JSON array
                else:
                    raise ValueError("Response is not a JSON array")
            except json.JSONDecodeError:
                # If response is not valid JSON, try to extract JSON array
                import re
                json_array_match = re.search(r'\[(.*?)\]', response_text, re.DOTALL)
                if json_array_match:
                    try:
                        questions_data = json.loads(f"[{json_array_match.group(1)}]")
                        return json.dumps(questions_data)
                    except json.JSONDecodeError:
                        pass
                
                # If all parsing attempts fail, format as a single question
                return json.dumps([{
                    "content": response_text,
                    "difficulty": "medium",
                    "bloom_level": "understand"
                }])
                
        raise Exception("No response content from Groq API")
        
    except Exception as e:
        print(f"Groq API error: {str(e)}")
        raise

# Update prompt for Llama model
QUESTION_GENERATION_PROMPT = """Please analyze the following text and generate as many high-quality questions that the user asks for that test understanding of the key concepts.

Text to analyze:
{text}

Requirements:
1. Questions should be clear and specific
2. Focus on important concepts and principles
3. Make questions thought-provoking
4. Format each question on a new line starting with a number

Generate the questions now."""

def chunk_text(text: str, max_length: int = MAX_CHUNK_SIZE) -> List[str]:
    """Split text into chunks of maximum length while preserving sentence boundaries"""
    if len(text) <= max_length:
        return [text]
    
    chunks = []
    current_chunk = ""
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]
    
    for sentence in sentences:
        if len(current_chunk) + len(sentence) + 2 <= max_length:
            current_chunk += sentence + ". "
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence + ". "
    
    if current_chunk:
        chunks.append(current_chunk.strip())
    
    return chunks

# Replace the QuestionClassifier class with this simpler version
class QuestionClassifier:
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not self._initialized:
            try:
                if pipeline is None:
                    print("Warning: transformers pipeline not available, using fallback classification")
                    self.difficulty_classifier = None
                    self.bloom_classifier = None
                else:
                    # Initialize the classifiers with zero-shot models
                    self.difficulty_classifier = pipeline(
                        "zero-shot-classification",
                        model="facebook/bart-large-mnli",
                        device=-1  # Use CPU for inference
                    )
                    
                    self.bloom_classifier = pipeline(
                        "zero-shot-classification",
                        model="facebook/bart-large-mnli",
                        device=-1  # Use CPU for inference
                    )
                
                # Define the candidate labels for classification
                self.difficulty_labels = [
                    "basic factual recall question",
                    "intermediate conceptual understanding question",
                    "advanced analytical thinking question"
                ]
                
                self.bloom_labels = [
                    "remember: recall facts and basic concepts",
                    "understand: explain ideas or concepts",
                    "apply: use information in new situations",
                    "analyze: draw connections among ideas",
                    "evaluate: justify a stand or decision",
                    "create: produce new or original work"
                ]
                
                # Define comprehensive keyword mappings for Bloom's levels
                self.bloom_keywords = {
                    "remember": [
                        "define", "list", "recall", "name", "identify", "state",
                        "match", "recognize", "label", "memorize", "what is",
                        "who", "when", "where", "which", "find", "choose",
                        "how many", "what does", "select"
                    ],
                    "understand": [
                        "explain", "describe", "discuss", "interpret", "outline",
                        "distinguish", "predict", "associate", "classify",
                        "summarize", "compare", "convert", "demonstrate",
                        "illustrate", "rephrase", "show", "translate",
                        "how would you explain", "can you clarify",
                        "what is the main idea"
                    ],
                    "apply": [
                        "solve", "implement", "use", "apply", "construct",
                        "develop", "model", "organize", "calculate", "modify",
                        "prepare", "produce", "relate", "show", "transfer",
                        "how would you use", "what examples", "how would you solve",
                        "how would you organize", "how would you apply"
                    ],
                    "analyze": [
                        "analyze", "differentiate", "examine", "compare",
                        "contrast", "investigate", "categorize", "separate",
                        "advertise", "subdivide", "determine", "diagram",
                        "deduce", "test", "why", "how does", "what are the parts",
                        "what are the functions", "what is the relationship"
                    ],
                    "evaluate": [
                        "evaluate", "assess", "justify", "critique", "recommend",
                        "defend", "determine", "support", "conclude", "compare",
                        "interpret", "judge", "rate", "validate", "value",
                        "what is your opinion", "do you agree", "what would you recommend",
                        "how would you rate", "what is most important"
                    ],
                    "create": [
                        "create", "design", "develop", "compose", "construct",
                        "propose", "devise", "formulate", "plan", "invent",
                        "imagine", "generate", "produce", "write", "integrate",
                        "how would you design", "what would happen if",
                        "can you propose", "how would you create",
                        "what solution would you suggest"
                    ]
                }
                
                self._initialized = True
            except Exception as e:
                print(f"Error initializing classifier: {str(e)}")
                self._initialized = False
    
    def classify_difficulty(self, question: str) -> QuestionDifficulty:
        """Classify question difficulty using zero-shot classification"""
        try:
            if not self._initialized or self.difficulty_classifier is None:
                return QuestionDifficulty.MEDIUM
                
            question = question.strip()
            if not question:
                return QuestionDifficulty.MEDIUM
            
            result = self.difficulty_classifier(
                question,
                self.difficulty_labels,
                multi_label=False
            )
            
            highest_label = result['labels'][0]
            highest_score = result['scores'][0]
            
            if highest_score < 0.5:
                return QuestionDifficulty.MEDIUM
                
            if "basic" in highest_label:
                return QuestionDifficulty.EASY
            elif "advanced" in highest_label:
                return QuestionDifficulty.HARD
            else:
                return QuestionDifficulty.MEDIUM
                
        except Exception as e:
            print(f"Difficulty classification error: {str(e)}")
            return QuestionDifficulty.MEDIUM
    
    def classify_bloom(self, question: str) -> str:
        """Classify question's Bloom's taxonomy level using keyword matching and zero-shot classification"""
        try:
            if not self._initialized:
                return "understand"
            
            question = question.lower().strip()
            if not question:
                return "understand"
            
            # Check for specific question patterns first
            if question.startswith("why") or "why does" in question or "why do" in question:
                print("Found 'Why' pattern - classifying as analyze")
                return "analyze"
            
            if question.startswith("what is") or question.startswith("what are") or question.startswith("define"):
                print("Found 'What is/are/Define' pattern - classifying as remember")
                return "remember"
            
            if question.startswith("how does") or question.startswith("how do") or "explain how" in question:
                print("Found 'How does/do' pattern - classifying as analyze")
                return "analyze"
            
            if question.startswith("evaluate") or question.startswith("assess") or "do you think" in question:
                print("Found evaluation pattern - classifying as evaluate")
                return "evaluate"
            
            if question.startswith("create") or question.startswith("design") or "how would you develop" in question:
                print("Found creation pattern - classifying as create")
                return "create"
            
            if question.startswith("apply") or "how would you use" in question or "solve" in question:
                print("Found application pattern - classifying as apply")
                return "apply"
            
            # First try keyword matching for more accurate results
            max_matches = 0
            best_level = None
            match_scores = {level: 0 for level in self.bloom_keywords.keys()}
            
            # Calculate match scores for each level with weighted scoring
            for level, keywords in self.bloom_keywords.items():
                for keyword in keywords:
                    if keyword in question:
                        # Give higher weight to keywords at the start of the question
                        if question.startswith(keyword):
                            match_scores[level] += 2
                        else:
                            match_scores[level] += 1
                        if match_scores[level] > max_matches:
                            max_matches = match_scores[level]
                            best_level = level
            
            print(f"Match scores: {match_scores}")
            
            # If we found keyword matches, return that level
            if best_level:
                print(f"Keyword matches found - Level: {best_level}, Score: {max_matches}")
                return best_level
            
            # Check for additional patterns
            if any(pattern in question for pattern in ["define", "list", "name", "what", "who", "when", "where", "which"]):
                print("Found remember pattern")
                return "remember"
            elif any(pattern in question for pattern in ["explain", "describe", "discuss", "outline"]):
                print("Found understand pattern")
                return "understand"
            elif any(pattern in question for pattern in ["why", "how does", "what if", "compare", "analyze"]):
                print("Found analyze pattern")
                return "analyze"
            
            # If no patterns match, use zero-shot classification
            if self.bloom_classifier is not None:
                print("Using zero-shot classification")
                result = self.bloom_classifier(
                    question,
                    self.bloom_labels,
                    multi_label=False
                )
            else:
                print("Zero-shot classifier not available, using fallback")
                return "understand"
            
            highest_label = result['labels'][0]
            highest_score = result['scores'][0]
            
            print(f"Zero-shot classification - Label: {highest_label}, Score: {highest_score}")
            
            # Extract the base bloom level from the label
            bloom_level = highest_label.split(":")[0].strip()
            return bloom_level
            
        except Exception as e:
            print(f"Bloom classification error: {str(e)}")
            return "understand"

# Initialize the classifier as a singleton after all routes are defined
question_classifier = QuestionClassifier()

# Update the generate_questions function to use all providers
async def generate_questions(text: str, provider: ModelProvider, params: QuestionGenerationParams) -> str:
    """Generate questions using specified provider and return raw text for review"""
    try:
        # Select the appropriate API based on provider
        api_response = None
        try:
            if provider == ModelProvider.GROQ:
                api_response = await call_groq_api(text, params)
            elif provider == ModelProvider.DEEPSEEK:
                api_response = await call_deepseek_api(text, params)
            elif provider == ModelProvider.OPENAI:
                api_response = await call_openai_api(text, params)
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported model provider: {provider}"
                )
        except Exception as api_error:
            print(f"API call failed for {provider}: {str(api_error)}")
            # Try fallback to a different provider if primary fails
            if provider != ModelProvider.OPENAI:
                print("Attempting fallback to OpenAI")
                api_response = await call_openai_api(text, params)
            else:
                raise

        if not api_response:
            raise Exception("No response from API")

        # Validate JSON response format
        try:
            questions_data = json.loads(api_response)
            if not isinstance(questions_data, list):
                questions_data = [questions_data]
            
            # Validate each question has required fields
            for q in questions_data:
                if not isinstance(q, dict):
                    raise ValueError("Question is not a dictionary")
                if "content" not in q:
                    raise ValueError("Question missing 'content' field")
                if "difficulty" not in q:
                    raise ValueError("Question missing 'difficulty' field")
                if "bloom_level" not in q:
                    raise ValueError("Question missing 'bloom_level' field")
            
            # If validation passes, return the original response
            return api_response.strip()
            
        except json.JSONDecodeError:
            # If not valid JSON, format it as JSON
            return json.dumps([{
                "content": api_response.strip(),
                "difficulty": "medium",
                "bloom_level": "understand"
            }])
            
    except Exception as e:
        print(f"Question generation error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate questions: {str(e)}"
        )

# Database Models
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class Class(Base):
    __tablename__ = "classes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    subject = Column(String)
    course_code = Column(String, nullable=True)
    semester = Column(String, nullable=True)
    year = Column(Integer, nullable=True)
    description = Column(String, nullable=True)
    department = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Draft(Base):
    __tablename__ = "drafts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    class_id = Column(Integer, ForeignKey("classes.id"))
    content = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_modified = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class FileStorage(Base):
    __tablename__ = "file_storage"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String)
    minio_path = Column(String)
    file_type = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

# Add draft models
class QuestionDraft(Base):
    __tablename__ = "question_drafts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    class_id = Column(Integer, ForeignKey("classes.id"))
    content = Column(String)
    status = Column(String, default="draft")  # draft, published, archived
    last_edited = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

# Add category models
class QuestionCategory(Base):
    __tablename__ = "question_categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

class QuestionCategoryAssignment(Base):
    __tablename__ = "question_category_assignments"
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"))
    category_id = Column(Integer, ForeignKey("question_categories.id"))

# Pydantic Models
class UserCreate(BaseModel):
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class QuestionCreate(BaseModel):
    content: str
    difficulty: Optional[QuestionDifficulty] = None  # Optional field, will be auto-classified if not provided

class GeneratePrompt(BaseModel):
    prompt: str
    provider: ModelProvider = ModelProvider.GROQ  # Default to Groq

class ClassCreate(BaseModel):
    name: str
    subject: str
    course_code: str | None = None
    semester: str | None = None
    year: int | None = None
    description: str | None = None
    department: str | None = None

class ClassResponse(BaseModel):
    id: int
    name: str
    subject: str
    course_code: str | None
    semester: str | None
    year: int | None
    description: str | None
    department: str | None
    created_at: datetime

    class Config:
        orm_mode = True

class DraftCreate(BaseModel):
    content: str
    class_id: int

class DraftResponse(BaseModel):
    id: int
    content: str
    class_id: int
    last_saved: datetime
    created_at: datetime

class QuestionMetadata(BaseModel):
    content: str
    difficulty: QuestionDifficulty
    bloom_level: BloomLevel

# Initialize FastAPI app
app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://localhost:5173"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=1)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        if not token or token == "null":
            raise HTTPException(
                status_code=401,
                detail="No authentication token provided",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            print(f"Decoded payload: {payload}")
        except Exception as decode_error:
            print(f"Token decode error: {str(decode_error)}")
            raise HTTPException(
                status_code=401,
                detail="Invalid token format",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Token missing user ID",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=401,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return user
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Authentication error: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

# Routes
@app.post("/register", response_model=Token)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    try:
        if not user.email or not user.password:
            raise HTTPException(status_code=400, detail="Email and password are required")
            
        db_user = db.query(User).filter(User.email == user.email).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        hashed_password = get_password_hash(user.password)
        db_user = User(email=user.email, password_hash=hashed_password)
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
        access_token = create_access_token({"sub": str(db_user.id)})
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Registration error: {str(e)}")  # For debugging
        raise HTTPException(status_code=500, detail="Internal server error during registration")

@app.post("/login", response_model=Token)
async def login(user: UserLogin, db: Session = Depends(get_db)):
    try:
        db_user = db.query(User).filter(User.email == user.email).first()
        if not db_user or not verify_password(user.password, db_user.password_hash):
            raise HTTPException(status_code=401, detail="Incorrect email or password")
        
        access_token = create_access_token({"sub": str(db_user.id)})
        print(f"Generated token for user {db_user.id}: {access_token}")
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        print(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/questions")
async def create_question(
    question: QuestionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        if not question.content or not question.content.strip():
            raise HTTPException(
                status_code=400,
                detail="Question content cannot be empty"
            )
            
        # Pre-classify the question before database operations
        content = question.content.strip()
        difficulty = question.difficulty or question_classifier.classify_difficulty(content)
        bloom_level = question_classifier.classify_bloom(content)
        
        print(f"Pre-classified question: Difficulty={difficulty}, Bloom's Level={bloom_level}")
            
        db_question = Question(
            content=content,
            user_id=current_user.id,
            difficulty=difficulty,
            bloom_level=bloom_level
        )
        
        try:
            db.add(db_question)
            db.commit()
            db.refresh(db_question)
            
            # Return immediately with all classifications
            return {
                "id": db_question.id,
                "content": db_question.content,
                "difficulty": db_question.difficulty,
                "bloom_level": db_question.bloom_level,
                "created_at": db_question.created_at.isoformat()
            }
        except Exception as db_error:
            db.rollback()
            print(f"Database error: {str(db_error)}")
            raise HTTPException(
                status_code=500,
                detail=f"Database error: {str(db_error)}"
            )
            
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error creating question: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error creating question: {str(e)}"
        )

@app.get("/questions")
async def get_questions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        print(f"Getting questions for user: {current_user.id}")
        questions = db.query(
            Question.id,
            Question.user_id,
            Question.content,
            Question.created_at,
            Question.difficulty,
            Question.bloom_level  # Add bloom_level to the query
        ).filter(
            Question.user_id == current_user.id
        ).order_by(Question.created_at.desc()).all()
        
        # Convert SQLAlchemy Row objects to dictionaries
        questions_list = []
        for q in questions:
            if q.content and q.content.strip():
                questions_list.append({
                    "id": q.id,
                    "content": q.content,
                    "created_at": q.created_at.isoformat(),
                    "user_id": q.user_id,
                    "difficulty": q.difficulty,
                    "bloom_level": q.bloom_level  # Include bloom_level in response
                })
        
        return questions_list
    except Exception as e:
        print(f"Error getting questions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving questions: {str(e)}"
        )

# Add security scheme
security = HTTPBearer()

@app.post("/upload")
async def upload_files(
    files: List[UploadFile] = File(...),
    provider: ModelProvider = Form(ModelProvider.GROQ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        generated_questions = []
        failed_files = []
        
        for file in files:
            try:
                print(f"Processing file: {file.filename}")
                content = await file.read()
                file_text = ""
                
                # Save content to temp file for processing
                with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file.filename.split('.')[-1]}") as temp_file:
                    temp_file.write(content)
                    temp_file_path = temp_file.name
                
                # Try Tika first for all file types
                try:
                    print("Trying Tika extraction...")
                    parsed = parser.from_file(temp_file_path)
                    if parsed["content"]:
                        file_text = parsed["content"].strip()
                        print(f"Tika extracted length: {len(file_text)}")
                except Exception as e:
                    print(f"Tika extraction failed: {str(e)}")
                
                # If Tika fails, try specific extractors based on file type
                if not file_text.strip():
                    if file.filename.lower().endswith('.pdf'):
                        try:
                            print("Trying PyPDF2...")
                            with open(temp_file_path, 'rb') as pdf_file:
                                pdf_reader = PyPDF2.PdfReader(pdf_file)
                                for page in pdf_reader.pages:
                                    file_text += page.extract_text()
                            print(f"PyPDF2 extracted length: {len(file_text)}")
                        except Exception as e:
                            print(f"PyPDF2 failed: {str(e)}")
                        
                        # Try pdfminer if PyPDF2 fails
                        if not file_text.strip():
                            try:
                                print("Trying pdfminer...")
                                file_text = pdfminer.high_level.extract_text(temp_file_path)
                                print(f"pdfminer extracted length: {len(file_text)}")
                            except Exception as e:
                                print(f"pdfminer failed: {str(e)}")
                        
                        # Try pdfplumber if pdfminer fails
                        if not file_text.strip():
                            try:
                                print("Trying pdfplumber...")
                                with pdfplumber.open(temp_file_path) as pdf:
                                    for page in pdf.pages:
                                        extracted_text = page.extract_text()
                                        if extracted_text:
                                            file_text += extracted_text + "\n"
                                print(f"pdfplumber extracted length: {len(file_text)}")
                            except Exception as e:
                                print(f"pdfplumber failed: {str(e)}")
                        
                        # OCR as last resort for PDFs
                        if not file_text.strip():
                            try:
                                print("Trying OCR...")
                                images = convert_from_bytes(content)
                                ocr_text = []
                                for image in images:
                                    text = pytesseract.image_to_string(image)
                                    if text:
                                        ocr_text.append(text)
                                file_text = "\n".join(ocr_text)
                                print(f"OCR extracted length: {len(file_text)}")
                            except Exception as e:
                                print(f"OCR failed: {str(e)}")
                
                # Clean up temp file
                try:
                    os.unlink(temp_file_path)
                except Exception as e:
                    print(f"Error deleting temp file: {str(e)}")
                
                # Process extracted text
                if file_text.strip():
                    print(f"Successfully extracted text. Length: {len(file_text)}")
                    
                    try:
                        # Generate questions using specified provider
                        params = QuestionGenerationParams(
                            prompt=file_text,
                            num_questions=15,
                            difficulty_distribution={
                                "easy": 5,
                                "medium": 5,
                                "hard": 5
                            }
                        )
                        questions = await generate_questions(file_text, provider, params)
                        if questions:
                            generated_questions.append(questions)
                    except Exception as e:
                        failed_files.append({
                            "filename": file.filename,
                            "error": str(e)
                        })
                        continue
                        
                else:
                    failed_files.append({
                        "filename": file.filename,
                        "error": "Could not extract text from file"
                    })
                    
            except Exception as file_error:
                failed_files.append({
                    "filename": file.filename,
                    "error": str(file_error)
                })
                continue

        if not generated_questions:
            if failed_files:
                return JSONResponse(
                    status_code=500,
                    content={
                        "message": "Failed to generate questions",
                        "failed_files": failed_files
                    }
                )
            return JSONResponse(
                status_code=500,
                content={
                    "message": "No questions could be generated from any files"
                }
            )

        return {
            "message": "Files processed successfully",
            "generated_questions": generated_questions,
            "failed_files": failed_files if failed_files else None
        }
            
    except Exception as e:
        print(f"Upload error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing files: {str(e)}"
        )

@app.post("/questions/approve")
async def approve_questions(
    questions: List[dict],  # Change type to List[dict] to handle JSON objects
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve and save generated questions after review"""
    try:
        saved_questions = []
        current_time = datetime.utcnow()
        
        for question_data in questions:
            try:
                # Parse the question data
                if isinstance(question_data, str):
                    # Handle legacy string format
                    content = re.sub(r'^\d+[\.\)]\s*', '', question_data.strip())
                    difficulty = question_classifier.classify_difficulty(content)
                    bloom_level = question_classifier.classify_bloom(content)
                else:
                    # Handle JSON format with classifications
                    content = question_data.get('content', '').strip()
                    difficulty = question_data.get('difficulty', 'medium').lower()
                    bloom_level = question_data.get('bloom_level', 'understand').lower()
                
                if content:
                    # Create question with timestamp and classifications
                    db_question = Question(
                        content=content,
                        difficulty=difficulty,
                        bloom_level=bloom_level,
                        user_id=current_user.id,
                        created_at=current_time
                    )
                    db.add(db_question)
                    saved_questions.append(db_question)
                    
                    # Increment time by 1 second for next question
                    current_time += timedelta(seconds=1)
            except Exception as e:
                print(f"Error processing question: {str(e)}")
                continue
        
        if not saved_questions:
            raise HTTPException(
                status_code=400,
                detail="No valid questions to save"
            )
        
        db.commit()
        
        # Refresh questions to get their IDs
        for q in saved_questions:
            db.refresh(q)
        
        return {
            "message": f"Successfully saved {len(saved_questions)} questions",
            "questions": [
                {
                    "id": q.id,
                    "content": q.content,
                    "difficulty": q.difficulty,
                    "bloom_level": q.bloom_level,
                    "created_at": q.created_at.isoformat()
                } for q in saved_questions
            ]
        }
        
    except Exception as e:
        db.rollback()
        print(f"Error approving questions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error saving questions: {str(e)}"
        )

@app.post("/generate")
async def generate_question(
    params: QuestionGenerationParams,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        print(f"Received params: {params}")
        
        # Generate questions using selected provider with params
        questions = await generate_questions(params.prompt, params.provider, params)
        
        if questions:
            # Parse the response as JSON
            try:
                questions_data = json.loads(questions)
                return {"questions": questions_data}
            except json.JSONDecodeError:
                # Fallback for non-JSON responses
                return {"questions": [{"content": questions, "difficulty": "medium", "bloom_level": "understand"}]}
        else:
            raise Exception("No questions generated")
                
    except Exception as e:
        print(f"Error generating question: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Add this new endpoint after the other question endpoints
@app.delete("/questions/{question_id}")
async def delete_question(question_id: int, db: Session = Depends(get_db)):
    try:
        # Get the question first to check if it exists
        question = db.query(Question).filter(Question.id == question_id).first()
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
            
        # Delete the question - cascade will handle related records
        db.delete(question)
        db.commit()
        
        return {
            "success": True,
            "message": "Question deleted successfully",
            "deleted_id": question_id
        }
        
    except Exception as e:
        db.rollback()
        print(f"Error deleting question: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete question: {str(e)}"
        )

# Create tables
Base.metadata.create_all(bind=engine)

# Create a function to add the column if it doesn't exist
async def add_class_id_column(engine):
    try:
        with engine.connect() as conn:
            # Check if column exists using text()
            from sqlalchemy import text
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='questions' AND column_name='class_id';
            """))
            
            if not result.fetchone():
                # Add the column if it doesn't exist
                conn.execute(text("ALTER TABLE questions ADD COLUMN class_id INTEGER REFERENCES classes(id);"))
                conn.commit()
                print("Added class_id column to questions table")
    except Exception as e:
        print(f"Error adding class_id column: {str(e)}")

# Add this after Base.metadata.create_all(bind=engine)
@app.on_event("startup")
async def startup_event():
    await add_class_id_column(engine)

# Add a root route for health check
@app.get("/")
async def root():
    return {"status": "ok", "message": "Question Generator API is running"}

@app.post("/classes", response_model=ClassResponse)
async def create_class(
    class_data: ClassCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        print(f"Creating class with data: {class_data}")  # Debug print
        
        # Validate required fields
        if not class_data.name or not class_data.subject:
            raise HTTPException(
                status_code=400,
                detail="Name and subject are required"
            )
        
        db_class = Class(
            user_id=current_user.id,
            name=class_data.name,
            subject=class_data.subject,
            course_code=class_data.course_code,
            semester=class_data.semester,
            year=class_data.year,
            description=class_data.description,
            department=class_data.department
        )
        
        try:
            db.add(db_class)
            db.commit()
            db.refresh(db_class)
            print(f"Class created successfully: {db_class.id}")  # Debug print
            return db_class
        except Exception as db_error:
            db.rollback()
            print(f"Database error: {str(db_error)}")  # Debug print
            raise HTTPException(
                status_code=500,
                detail=f"Database error: {str(db_error)}"
            )
            
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error creating class: {str(e)}")  # Debug print
        raise HTTPException(
            status_code=500,
            detail=f"Error creating class: {str(e)}"
        )

@app.get("/classes", response_model=List[ClassResponse])
async def get_classes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        print(f"Getting classes for user: {current_user.id}")  # Debug print
        classes = db.query(Class)\
            .filter(Class.user_id == current_user.id)\
            .all()
        
        # Convert to list of dicts for better serialization
        classes_list = [
            {
                "id": c.id,
                "name": c.name,
                "subject": c.subject,
                "course_code": c.course_code,
                "semester": c.semester,
                "year": c.year,
                "description": c.description,
                "department": c.department,
                "created_at": c.created_at
            } for c in classes
        ]
        
        return classes_list
    except Exception as e:
        print(f"Error getting classes: {str(e)}")  # Debug print
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving classes: {str(e)}"
        )

@app.get("/classes/{class_id}", response_model=ClassResponse)
async def get_class(
    class_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        db_class = db.query(Class)\
            .filter(Class.id == class_id, Class.user_id == current_user.id)\
            .first()
        if not db_class:
            raise HTTPException(
                status_code=404,
                detail="Class not found"
            )
        return db_class
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error getting class: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Error retrieving class"
        )

@app.put("/classes/{class_id}", response_model=ClassResponse)
async def update_class(
    class_id: int,
    class_data: ClassCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        db_class = db.query(Class)\
            .filter(Class.id == class_id, Class.user_id == current_user.id)\
            .first()
        if not db_class:
            raise HTTPException(
                status_code=404,
                detail="Class not found"
            )
        
        for key, value in class_data.dict().items():
            setattr(db_class, key, value)
        
        db.commit()
        db.refresh(db_class)
        return db_class
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error updating class: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Error updating class"
        )

@app.delete("/classes/{class_id}")
async def delete_class(
    class_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        db_class = db.query(Class)\
            .filter(Class.id == class_id, Class.user_id == current_user.id)\
            .first()
        if not db_class:
            raise HTTPException(
                status_code=404,
                detail="Class not found"
            )
        
        # Delete associated drafts first
        db.query(Draft)\
            .filter(Draft.class_id == class_id)\
            .delete(synchronize_session=False)
        
        db.delete(db_class)
        db.commit()
        return {"message": "Class deleted successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error deleting class: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Error deleting class"
        )

@app.post("/drafts")
async def create_draft(
    draft_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        draft = QuestionDraft(
            user_id=current_user.id,
            class_id=draft_data.get("class_id"),
            content=draft_data.get("content")
        )
        db.add(draft)
        db.commit()
        db.refresh(draft)
        return draft
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/drafts/{draft_id}")
async def update_draft(
    draft_id: int,
    draft_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        draft = db.query(QuestionDraft).filter(
            QuestionDraft.id == draft_id,
            QuestionDraft.user_id == current_user.id
        ).first()
        
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        
        for key, value in draft_data.items():
            setattr(draft, key, value)
        
        db.commit()
        db.refresh(draft)
        return draft
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/drafts/{draft_id}")
async def delete_draft(
    draft_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        db_draft = db.query(QuestionDraft)\
            .filter(QuestionDraft.id == draft_id, QuestionDraft.user_id == current_user.id)\
            .first()
        if not db_draft:
            raise HTTPException(
                status_code=404,
                detail="Draft not found"
            )
        
        db.delete(db_draft)
        db.commit()
        return {"message": "Draft deleted successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error deleting draft: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Error deleting draft"
        )

# Add MinIO helper functions
async def store_file_in_minio(file_content: bytes, filename: str, user_id: int) -> str:
    try:
        bucket_name = "eduquery-files"
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        content_hash = hashlib.md5(file_content).hexdigest()[:10]
        unique_filename = f"user_{user_id}/{timestamp}_{content_hash}_{filename}"

        # Ensure bucket exists
        if not minio_client.bucket_exists(bucket_name):
            minio_client.make_bucket(bucket_name)

        # Upload file
        minio_client.put_object(
            bucket_name,
            unique_filename,
            io.BytesIO(file_content),
            len(file_content)
        )
        return f"{bucket_name}/{unique_filename}"
    except Exception as e:
        print(f"MinIO storage error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to store file")

async def get_file_from_minio(file_path: str) -> bytes:
    try:
        bucket_name, object_name = file_path.split('/', 1)
        response = minio_client.get_object(bucket_name, object_name)
        return response.read()
    except Exception as e:
        print(f"MinIO retrieval error: {str(e)}")
        raise HTTPException(status_code=404, detail="File not found")

# Add this simpler text similarity function
def calculate_similarity(text1: str, text2: str) -> float:
    return SequenceMatcher(None, text1, text2).ratio()

# Replace the create_question_embedding and find_similar_questions functions with:
async def create_question_embedding(question_text: str) -> list:
    # Return a simple hash of the text as a list
    return [hash(question_text) % 1000000]

async def find_similar_questions(question_text: str, user_id: int, db: Session, limit: int = 5):
    """Find similar questions using simple text comparison"""
    questions = db.query(Question).filter(Question.user_id == user_id).all()
    
    # Calculate similarities
    similarities = [(q, calculate_similarity(question_text, q.content)) for q in questions]
    
    # Sort by similarity score and get top matches
    sorted_questions = sorted(similarities, key=lambda x: x[1], reverse=True)[:limit]
    
    return [
        {
            "id": q[0].id,
            "content": q[0].content,
            "similarity": q[1]
        }
        for q in sorted_questions
    ]

# Add search endpoint
@app.get("/questions/search")
async def search_questions(
    query: str,
    class_id: Optional[int] = None,
    category_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Base query
        questions_query = db.query(Question).filter(Question.user_id == current_user.id)
        
        # Add filters
        if class_id:
            questions_query = questions_query.filter(Question.class_id == class_id)
        
        if category_id:
            questions_query = questions_query.join(QuestionCategoryAssignment)\
                .filter(QuestionCategoryAssignment.category_id == category_id)
        
        # Add text search
        if query:
            questions_query = questions_query.filter(Question.content.ilike(f"%{query}%"))
        
        questions = questions_query.all()
        
        # Get similar questions if needed
        if query:
            similar_questions = await find_similar_questions(query, current_user.id, db)
            # Combine results...
            
        return questions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Instead, use this simpler version:
async def generate_with_llama(prompt: str) -> str:
    """Generate template-based questions when ML model is not available"""
    return f"""1. What are the key concepts in {prompt}?
2. How would you explain {prompt} to a beginner?
3. What are the practical applications of {prompt}?
4. What are the most important aspects to understand about {prompt}?
5. How does {prompt} relate to real-world scenarios?"""

class QuestionTag(Base):
    __tablename__ = "question_tags"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

class QuestionTagAssignment(Base):
    __tablename__ = "question_tag_assignments"
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"))
    tag_id = Column(Integer, ForeignKey("question_tags.id"))

@app.post("/questions/{question_id}/tags")
async def add_tags_to_question(
    question_id: int,
    tags: List[str],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        question = db.query(Question).filter(
            Question.id == question_id,
            Question.user_id == current_user.id
        ).first()
        
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        
        for tag_name in tags:
            # Get or create tag
            tag = db.query(QuestionTag).filter(
                QuestionTag.name == tag_name,
                QuestionTag.user_id == current_user.id
            ).first()
            
            if not tag:
                tag = QuestionTag(name=tag_name, user_id=current_user.id)
                db.add(tag)
                db.commit()
                db.refresh(tag)
            
            # Add tag assignment
            assignment = QuestionTagAssignment(
                question_id=question_id,
                tag_id=tag.id
            )
            db.add(assignment)
        
        db.commit()
        return {"message": "Tags added successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/questions/export")
async def export_questions(
    format: str = "json",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        questions = db.query(Question)\
            .filter(Question.user_id == current_user.id)\
            .all()
        
        if format == "json":
            questions_data = [
                {
                    "id": q.id,
                    "content": q.content,
                    "difficulty": q.difficulty,
                    "created_at": q.created_at.isoformat(),
                    "class_id": q.class_id
                } for q in questions
            ]
            return JSONResponse(content=questions_data)
        
        elif format == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["ID", "Content", "Difficulty", "Created At", "Class ID"])
            
            for q in questions:
                writer.writerow([q.id, q.content, q.difficulty, q.created_at, q.class_id])
            
            return Response(
                content=output.getvalue(),
                media_type="text/csv",
                headers={
                    "Content-Disposition": "attachment; filename=questions.csv"
                }
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/questions/batch")
async def batch_create_questions(
    questions: List[str],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        created_questions = []
        for content in questions:
            if content.strip():
                question = Question(
                    content=content.strip(),
                    user_id=current_user.id
                )
                db.add(question)
                created_questions.append(question)
        
        db.commit()
        for q in created_questions:
            db.refresh(q)
        
        return created_questions
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/questions/batch")
async def batch_delete_questions(
    question_ids: List[int],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        result = db.query(Question)\
            .filter(
                Question.id.in_(question_ids),
                Question.user_id == current_user.id
            )\
            .delete(synchronize_session=False)
        
        db.commit()
        return {"deleted_count": result}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

def calculate_text_similarity(text1: str, text2: str) -> float:
    """Calculate similarity between two texts using a simple ratio comparison"""
    return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()

async def find_similar_questions(question_text: str, user_id: int, db: Session, limit: int = 5):
    """Find similar questions using simple text comparison"""
    questions = db.query(Question).filter(Question.user_id == user_id).all()
    
    # Calculate similarities
    similarities = [(q, calculate_text_similarity(question_text, q.content)) for q in questions]
    
    # Sort by similarity score and get top matches
    sorted_questions = sorted(similarities, key=lambda x: x[1], reverse=True)[:limit]
    
    return [
        {
            "id": q[0].id,
            "content": q[0].content,
            "similarity": q[1]
        }
        for q in sorted_questions
    ]

@app.post("/questions/reclassify")
async def reclassify_questions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Get all questions for the user
        questions = db.query(Question).filter(
            Question.user_id == current_user.id
        ).all()
        
        updated_count = 0
        for question in questions:
            # Reclassify each question
            new_difficulty = question_classifier.classify_difficulty(question.content)
            if new_difficulty != question.difficulty:
                question.difficulty = new_difficulty
                updated_count += 1
        
        db.commit()
        
        return {
            "message": f"Successfully reclassified {updated_count} questions",
            "total_processed": len(questions),
            "updated_count": updated_count
        }
    except Exception as e:
        print(f"Error reclassifying questions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Error reclassifying questions"
        )

# Add DeepSeek API call function
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
async def call_deepseek_api(prompt: str, params: QuestionGenerationParams) -> str:
    """Call DeepSeek API with user-specified parameters"""
    try:
        session = requests.Session()
        adapter = requests.adapters.HTTPAdapter(
            pool_connections=5,
            pool_maxsize=5,
            max_retries=3,
            pool_block=False
        )
        session.mount('https://', adapter)
        
        session.headers.update({
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        })
        
        data = {
            "model": "deepseek-coder",
            "messages": [
                {
                    "role": "user",
                    "content": f"""You must generate EXACTLY {params.num_questions} high-quality questions with this EXACT distribution:
                    - Easy: {params.difficulty_distribution['easy']} questions
                    - Medium: {params.difficulty_distribution['medium']} questions
                    - Hard: {params.difficulty_distribution['hard']} questions

                    Each question MUST be formatted as a JSON object with these EXACT fields:
                    {{
                        "content": "The complete question text here",
                        "difficulty": "easy/medium/hard",
                        "bloom_level": "remember/understand/apply/analyze/evaluate/create"
                    }}

                    Your response MUST be a valid JSON array containing EXACTLY {params.num_questions} question objects.
                    Do not include any text outside the JSON array.
                    Do not include the word 'content:' or 'content' in the question text.
                    Do not include question numbers or prefixes.

                    Topic to generate questions about: {prompt}"""
                }
            ],
            "temperature": 0.7,
            "max_tokens": 4000,
            "stream": False,
            "presence_penalty": 0.6,
            "frequency_penalty": 0.6
        }
        
        try:
            response = await asyncio.to_thread(
                session.post,
                "https://api.deepseek.com/v1/chat/completions",
                json=data,
                timeout=(30, 120)  # Increased timeout (connection timeout, read timeout)
            )
            response.raise_for_status()
            
        except requests.Timeout:
            print("DeepSeek API timeout - retrying with simplified request")
            data["messages"][0]["content"] = f"""Generate EXACTLY {params.num_questions} questions about: {prompt}
            Each question MUST be a JSON object with content, difficulty, and bloom_level fields.
            Return ONLY a JSON array of question objects.
            Do not include the word 'content:' or 'content' in the question text."""
            response = await asyncio.to_thread(
                session.post,
                "https://api.deepseek.com/v1/chat/completions",
                json=data,
                timeout=(30, 90)
            )
            response.raise_for_status()
            
        try:
            result = response.json()
            if not result.get("choices"):
                raise Exception("No choices in DeepSeek API response")
                
            content = result["choices"][0]["message"]["content"].strip()
            if not content:
                raise Exception("Empty response from DeepSeek API")
            
            def clean_question_text(text):
                # Remove content: prefix and any variations
                text = re.sub(r'^content:\s*', '', text, flags=re.IGNORECASE)
                text = re.sub(r'^Content:\s*', '', text)
                text = re.sub(r'content\s*:', '', text, flags=re.IGNORECASE)
                text = re.sub(r'Content\s*:', '', text)
                # Remove question numbers and trailing punctuation
                text = re.sub(r'^\d+[\.\)]\s*', '', text)
                text = re.sub(r',\s*$', '', text)
                text = re.sub(r';\s*$', '', text)
                return text.strip()
            
            def extract_questions_from_text(text):
                # Try multiple patterns to extract questions
                questions = []
                
                # First try to find JSON arrays
                json_arrays = re.findall(r'\[[\s\S]*?\]', text)
                for json_array in json_arrays:
                    try:
                        array_data = json.loads(json_array)
                        if isinstance(array_data, list):
                            for item in array_data:
                                if isinstance(item, dict):
                                    question_text = clean_question_text(item.get("content", ""))
                                    if question_text:
                                        questions.append({
                                            "content": question_text,
                                            "difficulty": item.get("difficulty", "medium").lower(),
                                            "bloom_level": item.get("bloom_level", "understand").lower()
                                        })
                    except json.JSONDecodeError:
                        continue
                
                # If no valid JSON arrays found, try to find individual JSON objects
                if not questions:
                    json_objects = re.findall(r'{[\s\S]*?}', text)
                    for json_obj in json_objects:
                        try:
                            obj_data = json.loads(json_obj)
                            if isinstance(obj_data, dict):
                                question_text = clean_question_text(obj_data.get("content", ""))
                                if question_text:
                                    questions.append({
                                        "content": question_text,
                                        "difficulty": obj_data.get("difficulty", "medium").lower(),
                                        "bloom_level": obj_data.get("bloom_level", "understand").lower()
                                    })
                        except json.JSONDecodeError:
                            continue
                
                # If still no questions found, try to parse numbered questions
                if not questions:
                    numbered_questions = re.split(r'\n\s*\d+[\.\)]\s*', text)
                    for q in numbered_questions:
                        q = q.strip()
                        if q:
                            questions.append({
                                "content": clean_question_text(q),
                                "difficulty": "medium",
                                "bloom_level": "understand"
                            })
                
                return questions
            
            # Try to parse the entire response as JSON first
            try:
                questions_data = json.loads(content)
                if isinstance(questions_data, list):
                    valid_questions = []
                    for q in questions_data:
                        if isinstance(q, dict):
                            question_text = clean_question_text(q.get("content", ""))
                            if question_text:
                                valid_questions.append({
                                    "content": question_text,
                                    "difficulty": q.get("difficulty", "medium").lower(),
                                    "bloom_level": q.get("bloom_level", "understand").lower()
                                })
                    if valid_questions:
                        return json.dumps(valid_questions)
            except json.JSONDecodeError:
                pass
            
            # If that fails, try to extract questions from the text
            questions = extract_questions_from_text(content)
            if questions:
                return json.dumps(questions)
            
            # If all parsing attempts fail and we have any content, return it as a single question
            if content.strip():
                return json.dumps([{
                    "content": clean_question_text(content),
                    "difficulty": "medium",
                    "bloom_level": "understand"
                }])
            
            raise Exception("Could not parse response into valid questions")
                
        except (KeyError, IndexError) as e:
            raise Exception(f"Failed to parse DeepSeek API response: {str(e)}")
            
    except Exception as e:
        print(f"Error in call_deepseek_api: {str(e)}")
        raise
    finally:
        session.close()

# Add OpenAI Assistant API call function
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
async def call_openai_api(prompt: str, params: QuestionGenerationParams) -> str:
    """Call OpenAI API with user-specified parameters"""
    try:
        if openai_client is None:
            raise Exception("OpenAI client not available")
            
        completion = await asyncio.to_thread(
            lambda: openai_client.chat.completions.create(
                model="o3-mini",
                messages=[
                    {
                        "role": "user",
                        "content": f"""Generate exactly {params.num_questions} high-quality questions with the following distribution:
                        - Easy: {params.difficulty_distribution['easy']} questions
                        - Medium: {params.difficulty_distribution['medium']} questions
                        - Hard: {params.difficulty_distribution['hard']} questions

                        For each question:
                        1. Classify its difficulty (easy/medium/hard)
                        2. Classify its Bloom's Taxonomy level (remember/understand/apply/analyze/evaluate/create)
                        3. Format each question as a JSON object:
                        {{
                            "content": "The question text",
                            "difficulty": "easy/medium/hard",
                            "bloom_level": "remember/understand/apply/analyze/evaluate/create"
                        }}

                        IMPORTANT: Your response must be ONLY a valid JSON array of question objects. Do not include any other text.
                        Do not include the word 'content:' or 'content' in the question text.
                        Do not include question numbers or prefixes.

                        Topic to generate questions about: {prompt}"""
                    }
                ],
                temperature=0.7,
                max_tokens=4000
            )
        )
        
        if completion.choices:
            response_text = completion.choices[0].message.content.strip()
            
            def clean_question_text(text):
                # Remove content: prefix and any variations
                text = re.sub(r'^content:\s*', '', text, flags=re.IGNORECASE)
                text = re.sub(r'^Content:\s*', '', text)
                text = re.sub(r'content\s*:', '', text, flags=re.IGNORECASE)
                text = re.sub(r'Content\s*:', '', text)
                # Remove question numbers and trailing punctuation
                text = re.sub(r'^\d+[\.\)]\s*', '', text)
                text = re.sub(r',\s*$', '', text)
                text = re.sub(r';\s*$', '', text)
                return text.strip()
            
            # Try to parse as JSON
            try:
                questions_data = json.loads(response_text)
                if isinstance(questions_data, list):
                    valid_questions = []
                    for q in questions_data:
                        if isinstance(q, dict):
                            question_text = clean_question_text(q.get("content", ""))
                            if question_text:
                                valid_questions.append({
                                    "content": question_text,
                                    "difficulty": q.get("difficulty", "medium").lower(),
                                    "bloom_level": q.get("bloom_level", "understand").lower()
                                })
                    if valid_questions:
                        return json.dumps(valid_questions)
            except json.JSONDecodeError:
                # If response is not valid JSON, try to extract JSON array
                json_array_match = re.search(r'\[(.*?)\]', response_text, re.DOTALL)
                if json_array_match:
                    try:
                        questions_data = json.loads(f"[{json_array_match.group(1)}]")
                        valid_questions = []
                        for q in questions_data:
                            if isinstance(q, dict):
                                question_text = clean_question_text(q.get("content", ""))
                                if question_text:
                                    valid_questions.append({
                                        "content": question_text,
                                        "difficulty": q.get("difficulty", "medium").lower(),
                                        "bloom_level": q.get("bloom_level", "understand").lower()
                                    })
                        if valid_questions:
                            return json.dumps(valid_questions)
                    except json.JSONDecodeError:
                        pass
                
                # If all parsing attempts fail, format as a single question
                return json.dumps([{
                    "content": clean_question_text(response_text),
                    "difficulty": "medium",
                    "bloom_level": "understand"
                }])
                
        raise Exception("No response content from OpenAI API")
        
    except Exception as e:
        print(f"OpenAI API error: {str(e)}")
        raise
