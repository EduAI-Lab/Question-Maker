from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

def migrate():
    # Create database engine
    engine = create_engine(os.getenv("DATABASE_URL"))
    
    with engine.connect() as conn:
        # Create question_tags table if it doesn't exist
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS question_tags (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                user_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        
        # Create question_tag_assignments table if it doesn't exist
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS question_tag_assignments (
                id SERIAL PRIMARY KEY,
                question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
                tag_id INTEGER REFERENCES question_tags(id) ON DELETE CASCADE
            );
        """))
        
        conn.commit()
        print("Successfully created tags tables")

if __name__ == "__main__":
    migrate() 