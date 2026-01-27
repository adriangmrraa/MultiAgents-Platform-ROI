import asyncio
import json
import os
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def inspect_agent_36():
    load_dotenv()
    dsn = os.getenv("POSTGRES_DSN")
    if not dsn:
        print("Error: POSTGRES_DSN not found")
        return

    engine = create_async_engine(dsn.replace("postgresql://", "postgresql+asyncpg://"))
    
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT id, name, config, system_prompt_template FROM agents WHERE id = 36")
        )
        row = result.fetchone()
        if row:
            print(f"ID: {row[0]}")
            print(f"Name: {row[1]}")
            print("Config RAW:")
            print(row[2])
            print("System Prompt Template:")
            print(row[3])
        else:
            print("Agent 36 not found")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(inspect_agent_36())
