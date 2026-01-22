-- ==========================================
-- Nexus v5.9 - SCRIPT DE RESCATE DE ESQUEMA
-- ==========================================
-- Ejecuta este script en la consola SQL de tu base de datos (Supabase/Postgres)
-- si la auto-migración del backend falla o si necesitas resetear el motor RAG.

-- 1. Activar Extensiones Necesarias
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Crear Tabla de Documentos (Motor de Vectores)
-- IMPORTANTE: Usamos UUID para compatibilidad total con LangChain y Supabase
CREATE TABLE IF NOT EXISTS documents (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    content text,
    metadata jsonb,
    embedding vector(1536) -- Dimensiones para OpenAI text-embedding-ada-002 / text-embedding-3-small
);

-- 3. Función RPC para Búsqueda Vectorial (match_documents)
-- Esta función es llamada por el RAGCore para encontrar fragmentos relevantes.
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
  AND documents.metadata @> filter
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4. Índices de Búsqueda (Opcional - Mejora rendimiento con miles de docs)
-- CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE documents IS 'Almacén de conocimiento vectorial para el motor RAG de Nexus';
COMMENT ON FUNCTION match_documents IS 'Búsqueda por proximidad de coseno para recuperación de información';
