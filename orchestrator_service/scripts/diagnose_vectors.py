import asyncio
import os
import sys
from dotenv import load_dotenv
import json

# Add parent dir to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

# Attempt to import supabase, if failing we can't do much
try:
    from supabase import create_client
except ImportError:
    print("❌ Critical: 'supabase' package not found. Cannot connect to database.")
    sys.exit(1)

async def diagnose():
    print("--- DIAGNOSTIC START ---")
    try:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY")
        
        if not url or not key:
             print("❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env")
             return

        # Initialize Supabase Client directly (Bypassing RAGCore deps like bs4)
        supabase = create_client(url, key)
        
        print("Connected to Supabase (Direct Mode).")
        
        # Query documents table
        # Filter: metadata->>'collection' = 'ADN Personal' AND metadata->>'role' = 'hero_response'
        
        response = supabase.table("documents").select("*").eq("metadata->>collection", "ADN Personal").eq("metadata->>role", "hero_response").limit(5).execute()
        
        count = len(response.data)
        print(f"Found {count} vectors matching criteria.")
        
        if count > 0:
            print("\n✅ Identidad Clonada Correctamente. Muestra de Vectores:")
            for i, doc in enumerate(response.data):
                content = doc.get("content", "")[:200].replace("\n", " ") # Truncate for display
                meta = doc.get("metadata", {})
                print(f"[{i+1}] Timestamp: {meta.get('timestamp')} | Hero: {meta.get('hero')}")
                print(f"    Content: {content}...")
        else:
            print("\n❌ No se encontraron vectores de identidad (ADN Personal).")
            # Try to see if there are ANY documents in ADN Personal
            fallback = supabase.table("documents").select("*").eq("metadata->>collection", "ADN Personal").limit(1).execute()
            if fallback.data:
                print(f"Info: Found {len(fallback.data)} documents in 'ADN Personal' but they miss the 'role=hero_response' tag.")
                print("Possible Parser Error or wrong collection usage.")
            else:
                print("Info: Collection 'ADN Personal' is completely empty.")

    except Exception as e:
        print(f"❌ Error Critical: {e}")
        import traceback
        traceback.print_exc()

    print("\n--- DIAGNOSTIC END ---")

if __name__ == "__main__":
    asyncio.run(diagnose())
