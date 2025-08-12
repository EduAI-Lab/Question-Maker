from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

def migrate():
    # Create database engine
    engine = create_engine(os.getenv("DATABASE_URL"))
    
    # Add bloom_level column if it doesn't exist
    with engine.connect() as conn:
        # Check if column exists
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='questions' AND column_name='bloom_level';
        """))
        
        if not result.fetchone():
            print("Adding bloom_level column to questions table...")
            # Add the column with a default value of 'understand'
            conn.execute(text("""
                ALTER TABLE questions 
                ADD COLUMN bloom_level VARCHAR(20) DEFAULT 'understand' NOT NULL;
            """))
            conn.commit()
            print("Successfully added bloom_level column")
        else:
            print("Bloom_level column already exists")

if __name__ == "__main__":
    migrate() 