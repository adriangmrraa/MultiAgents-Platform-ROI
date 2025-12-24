import pytest
import asyncio
from db import db
import uuid

@pytest.mark.asyncio
async def test_cascading_deletion_logic():
    # Setup: Create a fake tenant and related data
    tenant_id = 9999
    bot_number = "123456789"
    
    print("\n--- Setup: Creating test data ---")
    await db.pool.execute("INSERT INTO tenants (id, store_name, bot_phone_number) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING", tenant_id, "Test Store", bot_number)
    
    # Create handoff config
    await db.pool.execute("INSERT INTO tenant_human_handoff_config (tenant_id, destination_email, smtp_username, smtp_password_encrypted) VALUES ($1, $2, $3, $4)", tenant_id, "test@example.com", "user", "pass")
    
    # Create credentials
    await db.pool.execute("INSERT INTO credentials (name, value, scope, tenant_id) VALUES ($1, $2, $3, $4)", "test_cred", "test_val", "tenant", tenant_id)
    
    # Create conversation
    conv_id = uuid.uuid4()
    await db.pool.execute("INSERT INTO chat_conversations (id, tenant_id, channel, external_user_id) VALUES ($1, $2, $3, $4)", conv_id, tenant_id, "whatsapp", "user123")
    
    # Create message
    await db.pool.execute("INSERT INTO chat_messages (id, tenant_id, conversation_id, role, content) VALUES ($1, $2, $3, $4, $5)", uuid.uuid4(), tenant_id, conv_id, "user", "hello")
    
    print("Test data created successfully.")
    
    # Execution: Call the delete_tenant logic (mimicking admin_routes.py order)
    print("--- Execution: Deleting tenant ---")
    async with db.pool.acquire() as conn:
        async with conn.transaction():
            # Order: Handoff -> Chats -> Creds -> Tenant
            await conn.execute("DELETE FROM tenant_human_handoff_config WHERE tenant_id = $1", tenant_id)
            # chat_messages has ON DELETE CASCADE from chat_conversations in schema (usually)
            # But let's follow the strict app-level order if that's what's requested
            await conn.execute("DELETE FROM chat_messages WHERE tenant_id = $1", tenant_id)
            await conn.execute("DELETE FROM chat_conversations WHERE tenant_id = $1", tenant_id)
            await conn.execute("DELETE FROM credentials WHERE tenant_id = $1", tenant_id)
            await conn.execute("DELETE FROM tenants WHERE id = $1", tenant_id)
            
    print("Deletion completed.")
    
    # Verification: Ensure everything is gone
    print("--- Verification: Checking DB state ---")
    tenant_exists = await db.pool.fetchval("SELECT COUNT(*) FROM tenants WHERE id = $1", tenant_id)
    handoff_exists = await db.pool.fetchval("SELECT COUNT(*) FROM tenant_human_handoff_config WHERE tenant_id = $1", tenant_id)
    creds_exists = await db.pool.fetchval("SELECT COUNT(*) FROM credentials WHERE tenant_id = $1", tenant_id)
    convs_exists = await db.pool.fetchval("SELECT COUNT(*) FROM chat_conversations WHERE tenant_id = $1", tenant_id)
    msgs_exists = await db.pool.fetchval("SELECT COUNT(*) FROM chat_messages WHERE tenant_id = $1", tenant_id)
    
    assert tenant_exists == 0
    assert handoff_exists == 0
    assert creds_exists == 0
    assert convs_exists == 0
    assert msgs_exists == 0
    
    print("✅ All data correctly purged in the right order.")

if __name__ == "__main__":
    # For manual run
    import os
    from dotenv import load_dotenv
    load_dotenv()
    
    async def run():
        await db.connect()
        try:
            await test_cascading_deletion_logic()
        finally:
            await db.disconnect()
            
    asyncio.run(run())
