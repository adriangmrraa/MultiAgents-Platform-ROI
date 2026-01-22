import psycopg2
import structlog
from app.core.config import settings

logger = structlog.get_logger(__name__)

def init_rag_db():
    """
    Initializes the Supabase/PostgreSQL database for RAG.
    Creates pgvector extension, documents table, and match_documents function.
    """
    if not settings.SUPABASE_DB_URL:
        logger.warning("rag_db_setup_skipped", reason="SUPABASE_DB_URL not set")
        return

    conn = None
    try:
        # Connect to Postgres
        conn = psycopg2.connect(settings.SUPABASE_DB_URL)
        conn.autocommit = True
        cur = conn.cursor()

        # 1. Enable vector extension
        logger.info("rag_db_enabling_vector_extension")
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

        # 2. Create documents table
        logger.info("rag_db_creating_table")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                content text,
                metadata jsonb,
                embedding vector(1536)
            );
        """)

        # 3. Create match_documents function for LangChain SupabaseVectorStore
        logger.info("rag_db_creating_rpc_function")
        cur.execute("""
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
        """)

        logger.info("rag_db_setup_complete")
        cur.close()
    except Exception as e:
        logger.error("rag_db_setup_failed", error=str(e))
        # We don't raise here to prevent boot failure if DB is temporarily down, 
        # but RAG will fail later if not fixed.
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    init_rag_db()
