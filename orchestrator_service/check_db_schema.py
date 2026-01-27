import asyncio
import asyncpg
import json

async def check_schema():
    dsn = "postgresql://postgres:f4e157c4a332148ec012@localhost:5432/postgres"
    try:
        conn = await asyncpg.connect(dsn)
        print("Connected to database successfully.")
        
        query = """
        SELECT 
            table_name, 
            column_name, 
            data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'chat_conversations'
        ORDER BY ordinal_position;
        """
        rows = await conn.fetch(query)
        print("\nStructure of 'chat_conversations':")
        for row in rows:
            print(f"- {row['column_name']}: {row['data_type']}")
            
        await conn.close()
    except Exception as e:
        print(f"Error connecting to DB: {e}")

if __name__ == "__main__":
    asyncio.run(check_schema())
