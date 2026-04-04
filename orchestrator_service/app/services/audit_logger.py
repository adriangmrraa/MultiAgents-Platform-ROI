"""
Audit Logger Service
Comprehensive audit trail for compliance (SOC2, ISO27001).
Logs all critical events with user_id, tenant_id, IP, user_agent, action, details.
"""

import structlog
import json
from typing import Optional
from datetime import datetime
from db import db

logger = structlog.get_logger()


class AuditLogger:
    """Audit logging service for compliance."""

    def __init__(self):
        # Use global db instance
        self.db = db

    async def log(
        self,
        user_id: Optional[str],
        tenant_id: Optional[int],
        action: str,
        ip_address: Optional[str],
        user_agent: Optional[str],
        details: dict,
    ):
        """
        Log an audit event.

        Args:
            user_id: UUID of the user who performed the action (optional)
            tenant_id: ID of the tenant (optional)
            action: Action name (e.g., 'auth.login', 'billing.plan_changed')
            ip_address: Client IP address
            user_agent: HTTP User-Agent header
            details: Additional structured details as dict
        """
        try:
            await self.db.execute(
                """
                INSERT INTO audit_logs (
                    user_id, tenant_id, action, ip_address, user_agent, details
                ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
            """,
                user_id,
                tenant_id,
                action,
                ip_address,
                user_agent,
                json.dumps(details),
            )

            # Also log to structured logs for alerting
            logger.info(
                "audit_event",
                action=action,
                user=user_id,
                tenant=tenant_id,
                ip=ip_address,
                user_agent=user_agent[:100] if user_agent else None,
            )
        except Exception as e:
            logger.error("audit_log_failed", error=str(e), action=action)
            # Don't raise - audit failures shouldn't break the main flow
            pass


# Global instance for easy import
audit_logger = AuditLogger()
