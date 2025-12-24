import asyncio
from db import db
from datetime import datetime
import uuid

async def verify_human_handoff_lockout():
    bot_number = "123456789"
    tenant_id = 9999
    
    print("\n--- Verifying Human Handoff Logic ---")
    
    # 1. Simulate Handoff Activation
    print("Activating Human Handoff (Lockout until 2099)...")
    lockout_date = datetime(2099, 12, 31)
    
    # Normally this is done in chat_conversations
    # Let's ensure a conversation exists
    conv_id = uuid.uuid4()
    await db.pool.execute("""
        INSERT INTO chat_conversations (id, tenant_id, channel, external_user_id, human_override_until) 
        VALUES ($1, $2, $3, $4, $5) 
        ON CONFLICT (channel, external_user_id) DO UPDATE SET human_override_until = $5
    """, conv_id, tenant_id, "whatsapp", "user123", lockout_date)
    
    # 2. Check Lockout State
    print("Checking if lockout is active in DB...")
    current_lockout = await db.pool.fetchval("SELECT human_override_until FROM chat_conversations WHERE id = $1", conv_id)
    
    print(f"Lockout date in DB: {current_lockout}")
    is_active = current_lockout > datetime.now().astimezone(current_lockout.tzinfo) if current_lockout.tzinfo else current_lockout > datetime.now()
    
    if is_active and current_lockout.year == 2099:
        print("✅ SUCCESS: Lockout is active and set to 2099.")
    else:
        print("❌ FAILURE: Lockout is not correctly set.")

if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    load_dotenv()
    
    async def run():
        await db.connect()
        try:
            await verify_human_handoff_lockout()
        finally:
            await db.disconnect()
            
    asyncio.run(run())
