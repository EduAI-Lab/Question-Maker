from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

def migrate():
    # Create database engine
    engine = create_engine(os.getenv("DATABASE_URL"))
    
    # Add difficulty column if it doesn't exist
    with engine.connect() as conn:
        # Check if column exists
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='questions' AND column_name='difficulty';
        """))
        
        if not result.fetchone():
            print("Adding difficulty column to questions table...")
            # Add the column with a default value of 'medium'
            conn.execute(text("""
                ALTER TABLE questions 
                ADD COLUMN difficulty VARCHAR(10) DEFAULT 'medium' NOT NULL;
            """))
            conn.commit()
            print("Successfully added difficulty column")
        else:
            print("Difficulty column already exists")

if __name__ == "__main__":
    migrate() 