import asyncio
import os
import asyncpg
from dotenv import load_dotenv

# Load env vars
load_dotenv()

# Fallback logic for loading .env (Same as v5.32 fix)
if not os.getenv("POSTGRES_DSN"):
    current_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(os.path.dirname(current_dir)) # ../../
    env_path = os.path.join(root_dir, '.env')
    if os.path.exists(env_path):
        print(f">> Loading .env from: {env_path}")
        load_dotenv(env_path)

POSTGRES_DSN = os.getenv("POSTGRES_DSN")

# Fix DSN for asyncpg
if POSTGRES_DSN and "postgres://" in POSTGRES_DSN:
    POSTGRES_DSN = POSTGRES_DSN.replace("postgres://", "postgresql://")
if POSTGRES_DSN and "+asyncpg" in POSTGRES_DSN:
    POSTGRES_DSN = POSTGRES_DSN.replace("+asyncpg", "")

async def migrate():
    print(">> Starting Nexus v5.33 Migration (WhatsApp Templates)...")
    
    if not POSTGRES_DSN:
        print("!! ERROR: POSTGRES_DSN not found.")
        return

    conn = await asyncpg.connect(POSTGRES_DSN)
    try:
        # Create whatsapp_templates table
        print("-> Creating 'whatsapp_templates' table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS whatsapp_templates (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(64) NOT NULL,
                language VARCHAR(10) DEFAULT 'es',
                body_text TEXT NOT NULL,
                status VARCHAR(32) DEFAULT 'PENDING',
                meta_template_id VARCHAR(128),
                components JSONB DEFAULT '[]',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(tenant_id, name)
            );
        """)

        # Indexes
        print("-> Creating Indexes...")
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_tenant ON whatsapp_templates (tenant_id);
            CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_status ON whatsapp_templates (status);
        """)

        print(">> Migration v5.33 Completed Successfully.")
        
    except Exception as e:
        print(f"!! Migration Failed: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(migrate())
