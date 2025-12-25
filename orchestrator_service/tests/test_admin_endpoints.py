import asyncio
import pytest
import json
import os
import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch
from dotenv import load_dotenv

# Load Env
load_dotenv()

# Standalone Test App Setup
from fastapi import FastAPI
from fastapi.testclient import TestClient

# Mock DB before importing admin_routes if needed, but admin_routes imports 'db' from 'db' module.
# We will patch 'db.pool' in the tests.
from admin_routes import router as admin_router, sanitize_payload

app = FastAPI()
app.include_router(admin_router)

client = TestClient(app)

# Dummy Agent/SuperAdmin Token matching default in admin_routes
ADMIN_TOKEN = "admin-secret-99" 
HEADERS = {"x-admin-token": ADMIN_TOKEN}

@pytest.mark.asyncio
async def test_analytics_failover():
    print("\n\n=== TEST 1: Analytics Cache & Fallback ===")
    
    from unittest.mock import AsyncMock

    # Mock Redis failure
    with patch("admin_routes.redis_client") as mock_redis, \
         patch("admin_routes.db.pool") as mock_db_pool:
         
        # Scenario 1: Redis Fails, DB Succeeds
        mock_redis.get.side_effect = Exception("Redis Connection Refused")
        mock_redis.setex.side_effect = Exception("Redis Connection Refused")
        
        # Mock DB response for stats
        # fetchval is async, so we must mock it as such
        mock_db_pool.fetchval = AsyncMock(side_effect=[
            10,   # Active Tenants
            1000, # Total Messages
            500   # Processed
        ])
        
        # We need to run this in a way that allows the async endpoint to execute.
        # TestClient handles async endpoints fine (synchronously wrapping them).
        
        response = client.get("/admin/stats", headers=HEADERS)
        print(f"Response Status: {response.status_code}")
        print(f"Response Body: {response.json()}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify Fallback Data
        if "error" in data:
            pytest.fail(f"Fallback DB query failed unexpectedly: {data['error']}")
            
        assert data["active_tenants"] == 10
        assert data["total_messages"] == 1000
        assert data["processed_messages"] == 500
        # cached_at might be present if logic adds it
        
        print("✅ Analytics Fallback Test Passed")

def test_telemetry_sanitization():
    print("\n=== TEST 2: Telemetry Sanitization ===")
    
    # Payload with sensitive info
    raw_payload = {
        "user_id": 101,
        "api_key": "sk-1234567890abcdef",
        "nested": {
            "smtp_password": "supersecretpassword",
            "safe_field": "ok"
        },
        "list_data": [
            {"token": "xyz-token-value"}
        ]
    }
    
    sanitized = sanitize_payload(raw_payload)
    print(f"Raw: {json.dumps(raw_payload, indent=2)}")
    print(f"Sanitized: {json.dumps(sanitized, indent=2)}")
    
    assert sanitized["api_key"] == "********"
    assert sanitized["nested"]["smtp_password"] == "********"
    assert sanitized["nested"]["safe_field"] == "ok"
    assert sanitized["list_data"][0]["token"] == "********"
    
    print("✅ Telemetry Sanitization Passed")

def test_admin_tools_security():
    print("\n=== TEST 3: Admin Tools Security ===")
    
    # 1. Test Restricted Action (Clear Cache) - Should work with Token
    with patch("admin_routes.redis_client") as mock_redis:
        mock_redis.keys.return_value = ["dashboard:stats"]
        mock_redis.delete.return_value = 1
        
        resp = client.post("/admin/ops/clear_cache", headers=HEADERS, json={"pattern": "dashboard:*"})
        assert resp.status_code == 200
        assert resp.json()["cleared"] == 1
        print("✅ Clear Cache Allowed")
        
    # 2. Test Invalid Action
    with patch("admin_routes.redis_client"):
        resp = client.post("/admin/ops/hack_database", headers=HEADERS, json={})
        assert resp.status_code == 400
        print(f"Invalid Action Response: {resp.status_code}")
        print("✅ Invalid Action Blocked")

    # 3. Test Unauthorized (No Token)
    resp = client.post("/admin/ops/clear_cache", headers={}, json={})
    # FastAPI Depends(verify) raises 401/422
    assert resp.status_code in [401, 422]
    print(f"Unauthorized Response: {resp.status_code}")
    print("✅ Unauthorized Access Blocked")

if __name__ == "__main__":
    # Running sync tests manually
    test_telemetry_sanitization()
    test_admin_tools_security()
    
    # Running async test manually
    asyncio.run(test_analytics_failover())
