import asyncio
import re
import structlog
from functools import wraps
from sqlalchemy import text
from app.core.database import engine
from app.models import Base
# Import all models to ensure they are registered in Base.metadata
from app import models 

logger = structlog.get_logger()

class SchemaSurgeon:
    """
    The 'Surgeon' that performs zero-token infrastructure repairs.
    Uses SQLAlchemy introspection to heal the DB Schema based on Python Models (SSOT).
    """

    @staticmethod
    async def heal(error: Exception):
        """
        Analyzes the error and performs strict surgical repairs.
        """
        error_msg = str(error).lower()
        
        # Case 1: Missing Table (Error 42P01)
        if "relation" in error_msg and "does not exist" in error_msg and "column" not in error_msg:
             # Logic to distinguish table vs column error
             pass
        # Note: The "column ... of relation ..." also contains "relation ... does not exist" substring?
        # No: "column c of relation t does not exist" -> "relation t" IS present, but "does not exist" refers to column context.
        # Strict checking:
        
        # Case 2: Missing Column (Error 42703)
        # Regex: column "col" of relation "table" does not exist
        # We simplify to find column and table pattern
        match = re.search(r'column\s+"(?P<col>[^"]+)"\s+of\s+relation\s+"(?P<table>[^"]+)"', error_msg)
        if match:
            table = match.group("table")
            column = match.group("col")
            await SchemaSurgeon._heal_missing_column(table, column)
            return

        # Case 1 Fallback (Missing Table)
        # If it says "relation ... does not exist" and we didn't match column pattern above
        if "relation" in error_msg and "does not exist" in error_msg:
             await SchemaSurgeon._heal_missing_tables()
             return

        # Fallback: Unknown Structural Error
        logger.warning("resilience_unknown_structure_error", error=error_msg)
        # We could trigger a full sync here, but let's be conservative
        await SchemaSurgeon._heal_missing_tables() 

    @staticmethod
    async def _heal_missing_tables():
        """
        Idempotent creation of all missing tables.
        """
        logger.info("resilience_healing_tables_start")
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("resilience_healing_tables_success")
        except Exception as e:
            logger.error("resilience_healing_tables_failed", error=str(e))

    @staticmethod
    async def _heal_missing_column(table_name: str, column_name: str):
        """
        Surgical injection of missing columns with safe defaults.
        """
        logger.info("resilience_healing_column_start", table=table_name, column=column_name)
        
        # 1. Find the Model definition (SSOT)
        target_table = Base.metadata.tables.get(table_name)
        if target_table is None:
             logger.error("resilience_model_not_found", table=table_name)
             return

        target_column = target_table.columns.get(column_name)
        if target_column is None:
             logger.error("resilience_column_not_in_model", table=table_name, column=column_name)
             return

        # 2. Determine SQL Type and Default
        # This is a simplified mapper. For complex types, RAG agent v3.2 would handle this.
        # But for v3.1 "Zero Token", we handle common types.
        col_type = str(target_column.type)
        
        # 3. Construct Safe Default
        # Postgres requires a default for NOT NULL columns added to existing rows
        sql_default = ""
        if not target_column.nullable:
            if "BOOLEAN" in col_type.upper():
                sql_default = "DEFAULT FALSE" # Safety
            elif "INT" in col_type.upper():
                sql_default = "DEFAULT 0"
            elif "CHAR" in col_type.upper() or "TEXT" in col_type.upper():
                sql_default = "DEFAULT ''"
            elif "JSON" in col_type.upper():
                sql_default = "DEFAULT '{}'"
            elif "TIMESTAMP" in col_type.upper():
                sql_default = "DEFAULT NOW()"
        
        # 4. Execute Injection
        alter_stmt = f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {column_name} {col_type} {sql_default}"
        
        try:
            async with engine.begin() as conn:
                await conn.execute(text(alter_stmt))
            logger.info("resilience_healing_column_success", query=alter_stmt)
        except Exception as e:
             logger.error("resilience_healing_column_failed", error=str(e))


def safe_db_call(func):
    """
    Interceptor Decorator.
    Wraps DB calls to catch Structural Errors, heal them, and retry.
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            # Detect Structural Errors
            msg = str(e).lower()
            is_structural = (
                "relation" in msg and "does not exist" in msg or
                "column" in msg and "does not exist" in msg or
                "undifinedtableerror" in str(type(e)).lower() or
                "undifinedcolumnerror" in str(type(e)).lower() or
                "programmingerror" in str(type(e)).lower()
            )
            
            if is_structural:
                logger.warning("resilience_interceptor_triggered", function=func.__name__, error=str(e))
                await SchemaSurgeon.heal(e)
                
                # Retry Logic (One shot)
                logger.info("resilience_retrying_operation", function=func.__name__)
                return await func(*args, **kwargs)
            
            # Re-raise if not structural or healing failed (implicit since we handle retry in 'if')
            raise e
    return wrapper
