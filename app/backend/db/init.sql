-- EduQuery.ai Database Initialization
-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table for vector similarity search
CREATE TABLE IF NOT EXISTS embeddings (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(1536),  -- OpenAI ada-002 dimension
    metadata JSONB,
    content_type VARCHAR(50) DEFAULT 'question',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS embeddings_vector_idx 
ON embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Create index for content type filtering
CREATE INDEX IF NOT EXISTS embeddings_content_type_idx 
ON embeddings (content_type);

-- Create index for metadata queries
CREATE INDEX IF NOT EXISTS embeddings_metadata_idx 
ON embeddings USING GIN (metadata);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_embeddings_updated_at 
    BEFORE UPDATE ON embeddings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();