import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ DATABASE_URL not set")
    exit(1)

# Ensure async driver
if "postgresql://" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

async def check_schema():
    print("🔍 Checking Schema for v5.42 (WhatsApp Templates)...")
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.begin() as conn:
        # 1. Check if table exists
        result = await conn.execute(text("SELECT to_regclass('whatsapp_templates');"))
        if not result.scalar():
            print("⚠️ Table 'whatsapp_templates' does not exist. It will be created by main app startup.")
            return

        # 2. Check for 'components' column
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='whatsapp_templates' AND column_name='components';
        """))
        
        if not result.scalar():
            print("⚠️ Column 'components' MISSING. Applying Patch...")
            try:
                await conn.execute(text("ALTER TABLE whatsapp_templates ADD COLUMN components JSONB DEFAULT '[]'"))
                print("✅ Column 'components' added successfully.")
            except Exception as e:
                print(f"❌ Failed to add column: {e}")
        else:
            print("✅ Column 'components' exists.")
            
        # 3. Check for 'meta_id' column
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='whatsapp_templates' AND column_name='meta_id';
        """))
        
        if not result.scalar():
            print("⚠️ Column 'meta_id' MISSING. Applying Patch...")
            try:
                await conn.execute(text("ALTER TABLE whatsapp_templates ADD COLUMN meta_id VARCHAR NULL"))
                print("✅ Column 'meta_id' added successfully.")
            except Exception as e:
                print(f"❌ Failed to add column: {e}")
        else:
            print("✅ Column 'meta_id' exists.")

    await engine.dispose()
    print("🏁 Schema Check Complete.")

if __name__ == "__main__":
    asyncio.run(check_schema())
