import asyncio
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from sqlalchemy import text
from app.core.resilience import SchemaSurgeon, safe_db_call

@pytest.mark.asyncio
async def test_heal_missing_tables():
    print("\n=== TEST: Heal Missing Tables (Error 42P01) ===")
    
    # Simulate Postgres Error
    error_msg = 'relation "tenants" does not exist'
    error = Exception(error_msg)
    
    with patch("app.core.resilience.engine") as mock_engine, \
         patch("app.core.resilience.Base.metadata.create_all") as mock_create_all:
         
        # Mock Async Context Manager for engine.begin()
        mock_conn = AsyncMock()
        mock_engine.begin.return_value.__aenter__.return_value = mock_conn
        
        await SchemaSurgeon.heal(error)
        
        # Verify create_all was called
        mock_conn.run_sync.assert_called() 
        print("✅ Correctly triggered Base.metadata.create_all")

@pytest.mark.asyncio
async def test_heal_missing_column():
    print("\n=== TEST: Heal Missing Column (Error 42703) ===")
    
    error_msg = 'column "is_active" of relation "tenants" does not exist'
    error = Exception(error_msg)
    
    with patch("app.core.resilience.engine") as mock_engine, \
         patch("app.core.resilience.Base.metadata.tables") as mock_tables:
         
        # Mock Model Definition
        mock_table = MagicMock()
        mock_column = MagicMock()
        mock_column.type = "BOOLEAN"
        # mock_column.nullable logic in resilience.py:
        # if not target_column.nullable: use DEFAULT
        # Let's say it is NOT nullable to trigger default injection
        mock_column.nullable = False 
        
        mock_table.columns.get.return_value = mock_column
        mock_tables.get.return_value = mock_table
        
        # Mock Async Connection
        mock_conn = AsyncMock()
        mock_engine.begin.return_value.__aenter__.return_value = mock_conn
        
        await SchemaSurgeon.heal(error)
        
        # Verify ALTER TABLE execution
        # Expected SQL: ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE
        
        args, _ = mock_conn.execute.call_args
        sql_executed = str(args[0])
        print(f"Executed SQL: {sql_executed}")
        
        assert "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_active" in sql_executed
        assert "DEFAULT FALSE" in sql_executed 
        
        print("✅ Correctly triggered ALTER TABLE injection")

@pytest.mark.asyncio
async def test_safe_db_call_decorator():
    print("\n=== TEST: Decorator Interception ===")
    
    # Mock Surgeon to verify it gets called
    with patch("app.core.resilience.SchemaSurgeon.heal", new_callable=AsyncMock) as mock_heal:
        
        # Define a flaky function
        # Call 1: Fails with Table Error
        # Call 2: Succeeds (simulating heal worked)
        mock_action = AsyncMock(side_effect=[
            Exception('relation "tenants" does not exist'),
            "Success"
        ])
        
        @safe_db_call
        async def flaky_operation():
            return await mock_action()
            
        result = await flaky_operation()
        
        assert result == "Success"
        assert mock_heal.call_count == 1
        assert mock_action.call_count == 2
        
        print("✅ Decorator intercepted error, healed, and retried successully")
        
if __name__ == "__main__":
    asyncio.run(test_heal_missing_tables())
    asyncio.run(test_heal_missing_column())
    asyncio.run(test_safe_db_call_decorator())
