import asyncio
import uuid
import httpx
from db import db

async def verify_origin_metadata():
    print("--- Origin Metadata Verification ---")
    
    # 1. Verify Schema
    cols = await db.pool.fetch("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'chat_conversations' 
        AND column_name IN ('platform_origin', 'source_identifier', 'source_entity_id')
    """)
    found_cols = [c['column_name'] for c in cols]
    print(f"Schema Check: {found_cols}")
    assert len(found_cols) == 3, "Missing columns in chat_conversations"

    # 2. Simulate Ingestion
    tenant_id = 1
    asset_id = "page_123_test"
    asset_name = "Test Fanpage"
    sender_id = f"user_{uuid.uuid4().hex[:8]}"
    
    # Pre-requisite: Add asset to business_assets
    print(f"Injecting mock asset: {asset_name} ({asset_id})")
    await db.pool.execute("""
        INSERT INTO business_assets (tenant_id, asset_type, asset_id, name, content)
        VALUES ($1, 'facebook_page', $2, $3, '{}')
        ON CONFLICT (tenant_id, asset_id) DO UPDATE SET name = EXCLUDED.name
    """, str(tenant_id), asset_id, asset_name)

    # Ingest Message
    print(f"Simulating ingestion for recipient_id: {asset_id}")
    url = "http://localhost:8000/ingest/message" # Assuming running locally or reachable
    # Note: verify_internal_secret requires X-Internal-Secret header
    # For this script we'll just check if we can call the ingest_routes logic if imported,
    # OR we use HTTP if the service is up. 
    # Let's assume we want to test the full flow via HTTP.
    
    headers = {"X-Internal-Secret": "7876867976967967967463422222456467776967967585795679"}
    payload = {
        "provider": "meta",
        "platform": "facebook",
        "tenant_id": str(tenant_id),
        "recipient_id": asset_id,
        "sender_id": sender_id,
        "payload": {"text": "Hola verification test"}
    }
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
            print(f"Ingestion Response: {resp.status_code} - {resp.text}")
            
            # 3. Verify DB Results
            conv = await db.pool.fetchrow("""
                SELECT platform_origin, source_identifier, source_entity_id 
                FROM chat_conversations 
                WHERE external_user_id = $1
            """, sender_id)
            
            print(f"Stored Metadata: {dict(conv) if conv else 'None'}")
            assert conv['platform_origin'] == 'facebook'
            assert conv['source_identifier'] == asset_name
            assert conv['source_entity_id'] == asset_id
            print("Verification SUCCESS")
            
        except Exception as e:
            print(f"Verification FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(verify_origin_metadata())
