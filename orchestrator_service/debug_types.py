
import asyncio
import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()

# Fallback defaults if env vars are missing/different in this context
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "postgres")
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_NAME = os.getenv("POSTGRES_DB", "postgres")

DSN = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

async def main():
    print(f"Connecting to {DSN}...")
    try:
        conn = await asyncpg.connect(DSN)
        print("Connected.")
        
        print("\n--- PROVEDORES (oauth_providers) ---")
        rows = await conn.fetch("SELECT * FROM oauth_providers")
        for r in rows:
            print(dict(r))
            
        print("\n--- TIPOS DE CREDENCIALES (credential_types) ---")
        rows = await conn.fetch("SELECT * FROM credential_types")
        for r in rows:
            print(dict(r))
            
        await conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
