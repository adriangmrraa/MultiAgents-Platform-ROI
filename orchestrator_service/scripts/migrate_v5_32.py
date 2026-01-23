import asyncio
import os
import asyncpg
from dotenv import load_dotenv

# Load env vars
load_dotenv()

# Fallback: Try loading from parent directory if not found (Common in this project structure)
if not os.getenv("POSTGRES_DSN"):
    current_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(os.path.dirname(current_dir)) # ../../
    env_path = os.path.join(root_dir, '.env')
    if os.path.exists(env_path):
        print(f">> Loading .env from: {env_path}")
        load_dotenv(env_path)
    else:
        # Try orchestrator_service/.env
        service_dir = os.path.dirname(current_dir)
        env_path_service = os.path.join(service_dir, '.env')
        if os.path.exists(env_path_service):
            print(f">> Loading .env from: {env_path_service}")
            load_dotenv(env_path_service)

POSTGRES_DSN = os.getenv("POSTGRES_DSN")

# Fix DSN for asyncpg
if POSTGRES_DSN and "postgres://" in POSTGRES_DSN:
    POSTGRES_DSN = POSTGRES_DSN.replace("postgres://", "postgresql://")
if POSTGRES_DSN and "+asyncpg" in POSTGRES_DSN:
    POSTGRES_DSN = POSTGRES_DSN.replace("+asyncpg", "")

async def migrate():
    print(">> Starting Nexus v5.32 Migration (Shadow RAG)...")
    
    if not POSTGRES_DSN:
        print("!! ERROR: POSTGRES_DSN not found.")
        return

    conn = await asyncpg.connect(POSTGRES_DSN)
    try:
        # 1. Update Customer Table
        print("-> Altering 'customers' table...")
        await conn.execute("""
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='circle') THEN 
                    ALTER TABLE customers ADD COLUMN circle VARCHAR(20) DEFAULT 'unknown';
                END IF;
            END $$;
        """)
        
        # 2. Update ChatMessage Table
        print("-> Altering 'chat_messages' table...")
        await conn.execute("""
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='is_shadow_indexed') THEN 
                    ALTER TABLE chat_messages ADD COLUMN is_shadow_indexed BOOLEAN DEFAULT FALSE;
                END IF;
            END $$;
        """)

        # 3. Create Vector Table for Chats (Supabase pgvector)
        # Note: We rely on Supabase's 'documents' table logic but for a separate collection-like structure?
        # IMPORTANT: The user requested a NEW COLLECTION called 'chats_vectors'.
        # In Supabase/pgvector with LangChain, usually we share the table 'documents' and filter by metadata.
        # BUT, if we validly want a SEPARATE table, we must define it.
        # However, re-using 'documents' with `source='shadow_chat'` is standard practice in single-store setups.
        # Given the instruction "Configura el servicio RAG... para manejar una colección separada llamada chats_vectors",
        # AND "metadata schema critical...", it often implies using the same store but different metadata.
        # BUT, usually separate "collection" in Chroma means separate folder. In Postgres, it's either a table or a filtered view.
        # Let's create a SEPARATE TABLE `chats_vectors` to strictly follow instructions and avoid polluting the main knowledge base.
        
        print("-> Creating 'chats_vectors' table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS chats_vectors (
                id uuid primary key default gen_random_uuid(),
                content text,
                metadata jsonb,
                embedding vector(1536)
            );
        """)

        # Enable vector indexing for performance
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS chats_vectors_embedding_idx ON chats_vectors USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100);
        """)

        print(">> Migration v5.32 Completed Successfully.")
        
    except Exception as e:
        print(f"!! Migration Failed: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(migrate())
