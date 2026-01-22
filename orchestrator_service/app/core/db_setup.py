import psycopg2
import structlog
from app.core.config import settings

logger = structlog.get_logger(__name__)

def init_rag_db():
    """
    Initializes the Supabase/PostgreSQL database for RAG.
    Creates pgvector extension, documents table, and match_documents function.
    Raises exceptions on failure for better debugging.
    """
    if not settings.SUPABASE_DB_URL:
        logger.warning("rag_db_setup_skipped", reason="SUPABASE_DB_URL not set")
        return "SUPABASE_DB_URL not set"

    conn = None
    try:
        # Connect to Postgres
        # Ensure sslmode is handled. Usually in red interna disable or prefer is better.
        db_url = settings.SUPABASE_DB_URL
        if "sslmode=" not in db_url:
            separator = "&" if "?" in db_url else "?"
            db_url += f"{separator}sslmode=prefer"
        
        logger.info("rag_db_connecting", url_preview=db_url.split('@')[-1])
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()

        # Check connection
        cur.execute("SELECT 1;")
        logger.info("rag_db_connection_success")

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
        return "ok"
    except Exception as e:
        logger.error("rag_db_setup_failed", error=str(e))
        # Important: Raise or return the error so the endpoint can show it
        raise e
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    try:
        init_rag_db()
    except Exception as e:
        print(f"FATAL: {e}")
