import asyncio
import json
import os
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def get_urban_roots_config():
    load_dotenv()
    dsn = os.getenv("POSTGRES_DSN")
    if not dsn:
        print("Error: POSTGRES_DSN not found")
        return

    engine = create_async_engine(dsn.replace("postgresql://", "postgresql+asyncpg://"))
    
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT config FROM agents WHERE name LIKE :name OR (config->>'store_name') LIKE :name LIMIT 1"),
            {"name": "%Urban Roots%"}
        )
        row = result.fetchone()
        if row:
            config = row[0]
            if isinstance(config, str):
                config = json.loads(config)
            print(json.dumps(config, indent=2))
        else:
            print("No config found for Urban Roots")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(get_urban_roots_config())
