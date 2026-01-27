import asyncio
import json
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def inspect_agent_36():
    # Explicitly load env
    env_path = r"c:\Users\Asus\Downloads\Platform AI Solutions\.env"
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if '=' in line:
                    key, value = line.strip().split('=', 1)
                    os.environ[key] = value
    
    dsn = os.getenv("POSTGRES_DSN")
    if not dsn:
        print("Error: POSTGRES_DSN not found in env")
        return

    print(f"Connecting to DB...")
    engine = create_async_engine(dsn.replace("postgresql://", "postgresql+asyncpg://"))
    
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT id, name, config, system_prompt_template FROM agents WHERE id = 36")
        )
        row = result.fetchone()
        if row:
            print(f"ID: {row[0]}")
            print(f"Name: {row[1]}")
            print("Config TYPE:", type(row[2]))
            print("Config RAW:")
            # Use repr to see if there are weird escape sequences
            print(repr(row[2]))
            print("System Prompt Template:")
            print(repr(row[3]))
        else:
            print("Agent 36 not found")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(inspect_agent_36())
