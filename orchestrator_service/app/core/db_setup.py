import asyncio
import psycopg2
import structlog
from app.core.config import settings

logger = structlog.get_logger(__name__)

async def background_db_setup():
    """
    Non-blocking background task that retries DB initialization.
    Nexus v5.9 - Self-Healing Protocol.
    """
    max_retries = 10
    retry_delay = 5  # seconds

    for attempt in range(1, max_retries + 1):
        try:
            logger.info("background_db_setup_attempt", attempt=attempt, max=max_retries)
            # Run the synchronous init_rag_db in a separate thread
            result = await asyncio.to_thread(init_rag_db)
            
            if "ok" in result.lower():
                logger.info("background_db_setup_success", attempt=attempt)
                print(">> INFO: Database Schema Verified/Created")
                return True
            
            logger.warning("background_db_setup_retry", attempt=attempt, reason=result)
        except Exception as e:
            logger.error("background_db_setup_error", attempt=attempt, error=str(e))
        
        if attempt < max_retries:
            await asyncio.sleep(retry_delay)
    
    logger.error("background_db_setup_failed_all_attempts")
    return False

def init_rag_db():
    """
    Initializes the Supabase/PostgreSQL database for RAG.
    Creates pgvector extension, documents table, and match_documents function.
    Synchronous function designed to be called via asyncio.to_thread.
    """
    if not settings.SUPABASE_DB_URL:
        logger.warning("rag_db_setup_skipped", reason="SUPABASE_DB_URL not set")
        return "SUPABASE_DB_URL not set"

    conn = None
    try:
        db_url = settings.SUPABASE_DB_URL
        # Ensure sslmode is handled without duplicates
        if "sslmode=" not in db_url:
            separator = "&" if "?" in db_url else "?"
            db_url += f"{separator}sslmode=prefer"
        
        # connect_timeout=5 to prevent hang (Nexus v5.9)
        conn = psycopg2.connect(db_url, connect_timeout=5)
        conn.autocommit = True
        cur = conn.cursor()

        # 1. Enable vector extension
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

        # 2. Create documents table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                content text,
                metadata jsonb,
                embedding vector(1536)
            );
        """)

        # 3. Create match_documents function
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

        cur.close()
        return "ok"
    except Exception as e:
        return f"failed: {str(e)}"
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    # For local CLI testing
    print("Testing init_rag_db...")
    print(init_rag_db())
