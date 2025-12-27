import asyncio
import os
import json
# Hardcoded connection logic to avoid import issues
import asyncpg

async def diagnose():
    dsn = os.getenv("POSTGRES_DSN")
    if not dsn:
        print("POSTGRES_DSN not found")
        return
    
    conn = await asyncpg.connect(dsn)
    
    # Check table columns
    rows = await conn.fetch("""
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'agents'
        ORDER BY ordinal_position
    """)
    print("\n--- SCHEMA OF 'agents' ---")
    for r in rows:
        print(f"Col: {r['column_name']}, Type: {r['data_type']}, Default: {r['column_default']}, Null: {r['is_nullable']}")

    # Check if id has a sequence
    has_seq = await conn.fetchval("""
        SELECT EXISTS (
            SELECT 1 FROM pg_class WHERE relname = 'agents_id_seq'
        )
    """)
    print(f"\nSequence 'agents_id_seq' exists: {has_seq}")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(diagnose())
