import asyncio
import os
import json
import sys
from dotenv import load_dotenv

# Add orchestrator to path
sys.path.append(os.path.join(os.getcwd(), 'orchestrator_service'))
from db import db

async def inspect_agent():
    # Load env from root
    load_dotenv(os.path.join(os.getcwd(), '.env'))
    
    # Init DB
    await db.connect()
    
    # Query Agent 37
    q = "SELECT id, name, config, system_prompt_template, template_type FROM agents WHERE id = 37;"
    row = await db.pool.fetchrow(q)
    
    if row:
        print(f"Agent ID: {row['id']}")
        print(f"Name: {row['name']}")
        print(f"Template Type: {row['template_type']}")
        print(f"Config Type: {type(row['config'])}")
        print(f"Config: {json.dumps(row['config'], indent=2)}")
    else:
        print("Agent 37 not found.")
        
    await db.close()

if __name__ == "__main__":
    asyncio.run(inspect_agent())
