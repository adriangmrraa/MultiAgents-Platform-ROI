import asyncio
import os
from db import db

async def diagnose():
    await db.connect()
    # Check table columns
    columns = await db.pool.fetch("""
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'agents'
        ORDER BY ordinal_position
    """)
    print("\n--- AGENTS TABLE COLUMNS ---")
    for col in columns:
        print(f"Column: {col['column_name']}, Type: {col['data_type']}, Default: {col['column_default']}, Nullable: {col['is_nullable']}")

    # Check sequences
    try:
        seqs = await db.pool.fetch("""
            SELECT relname FROM pg_class WHERE relkind = 'S' AND relname LIKE 'agents%'
        """)
        print("\n--- AGENTS SEQUENCES ---")
        for s in seqs:
            print(f"Sequence: {s['relname']}")
    except:
        print("\nNo sequences found or error.")

    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(diagnose())
