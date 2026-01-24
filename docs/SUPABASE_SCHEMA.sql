-- Nexus v6.0: The Sacred RAG Schema Script
-- Run this in the Supabase SQL Editor to initialize or repair the vector store.

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create Documents Table
-- Note: id MUST be UUID for 2026 Sovereign Compatibility
CREATE TABLE IF NOT EXISTS documents (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    content text,
    metadata jsonb,
    embedding vector(1536) -- Optimized for OpenAI text-embedding-3-small
);

-- 3. Create match_documents function with Strict Filter Isolation
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter jsonb DEFAULT '{}'
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
    AND documents.metadata @> filter -- THE SACRED FILTER (Strict Isolation)
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
