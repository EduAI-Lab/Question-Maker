from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import Question
import os
from dotenv import load_dotenv

load_dotenv()

# Database setup
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def cleanup_empty_questions():
    db = SessionLocal()
    try:
        # Delete questions with empty or whitespace-only content
        result = db.query(Question)\
            .filter(Question.content.strip() == '')\
            .delete(synchronize_session=False)
        db.commit()
        print(f"Deleted {result} empty questions")
    except Exception as e:
        print(f"Error cleaning up empty questions: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_empty_questions() 