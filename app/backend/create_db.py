import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
from dotenv import load_dotenv

load_dotenv()

# Database connection parameters from environment variables
db_params = os.getenv("DATABASE_URL")
db_name = db_params.split("/")[-1]
db_user = db_params.split("://")[1].split(":")[0]
db_password = db_params.split(":")[2].split("@")[0]
db_host = db_params.split("@")[1].split(":")[0]

def create_database():
    # Connect to PostgreSQL server
    conn = psycopg2.connect(
        user=db_user,
        password=db_password,
        host=db_host
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    
    # Check if database exists
    cursor.execute("SELECT 1 FROM pg_catalog.pg_database WHERE datname = %s", (db_name,))
    exists = cursor.fetchone()
    
    if not exists:
        cursor.execute(f'CREATE DATABASE {db_name}')
        print(f"Database {db_name} created successfully!")
    else:
        print(f"Database {db_name} already exists!")
    
    cursor.close()
    conn.close()

def create_tables():
    try:
        # Connect to the specific database
        conn = psycopg2.connect(db_params)
        cursor = conn.cursor()
        
        # Drop existing tables if they exist
        cursor.execute('''
            DROP TABLE IF EXISTS drafts CASCADE;
            DROP TABLE IF EXISTS questions CASCADE;
            DROP TABLE IF EXISTS classes CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
        ''')
        
        # Create users table first
        cursor.execute('''
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        print("Users table created successfully!")
        
        # Create classes table
        cursor.execute('''
            CREATE TABLE classes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                name VARCHAR(255) NOT NULL,
                subject VARCHAR(255) NOT NULL,
                course_code VARCHAR(50),
                semester VARCHAR(50),
                year INTEGER,
                description TEXT,
                department VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        print("Classes table created successfully!")
        
        # Create questions table
        cursor.execute('''
            CREATE TABLE questions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        print("Questions table created successfully!")
        
        # Create drafts table
        cursor.execute('''
            CREATE TABLE drafts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                class_id INTEGER REFERENCES classes(id),
                content TEXT NOT NULL,
                last_saved TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        print("Drafts table created successfully!")
        
        conn.commit()
        print("All tables created successfully!")
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"An error occurred while creating tables: {e}")
        raise e

if __name__ == "__main__":
    try:
        create_database()
        create_tables()
        print("Database setup completed successfully!")
    except Exception as e:
        print(f"An error occurred: {e}")