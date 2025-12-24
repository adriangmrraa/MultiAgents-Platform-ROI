import sys
import httpx
import os

def check_services():
    print("Starting Nexus Service Health Check...")
    
    # Define services using internal Docker network names if running inside, 
    # or localhost ports if running from outside. 
    # Assuming execution from outside context (Deploy check) or via 'run' command.
    
    services = {
        "Orchestrator": f"{os.getenv('ORCHESTRATOR_URL', 'http://localhost:8000')}/health",
        "WhatsApp": f"{os.getenv('WHATSAPP_URL', 'http://localhost:8002')}/health",
        "BFF": f"{os.getenv('BFF_URL', 'http://localhost:3000')}/health"
    }
    
    all_ok = True
    
    for name, url in services.items():
        try:
            print(f"Checking {name} at {url}...")
            # Timeout 2s is enough for local ping
            resp = httpx.get(url, timeout=5) 
            if resp.status_code == 200:
                print(f"[OK] {name}: {resp.text}")
            else:
                print(f"[FAIL] {name}: Status {resp.status_code}")
                all_ok = False
        except Exception as e:
            print(f"[FAIL] {name}: Network Error - {e}")
            all_ok = False

    if all_ok:
        print("\nAll Systems Nexus-Ready (Green).")
        sys.exit(0)
    else:
        print("\nSome systems reported failures.")
        sys.exit(1)

if __name__ == "__main__":
    check_services()
