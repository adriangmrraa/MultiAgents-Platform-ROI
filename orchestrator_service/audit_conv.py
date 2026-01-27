
import asyncio
import os
from db import Database

async def audit():
    db = Database()
    await db.connect()
    
    conv_id = 'ccbce3c0-0ba8-4955-ae57-d38632704dbd'
    row = await db.pool.fetchrow("SELECT id, external_chatwoot_id, external_account_id, channel_source, meta FROM chat_conversations WHERE id = $1", conv_id)
    
    if row:
        print(f"ID: {row['id']}")
        print(f"External CW ID: {row['external_chatwoot_id']}")
        print(f"External Account ID: {row['external_account_id']}")
        print(f"Channel Source: {row['channel_source']}")
        print(f"Meta: {row['meta']}")
    else:
        print("Conversation not found")
        
    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(audit())
