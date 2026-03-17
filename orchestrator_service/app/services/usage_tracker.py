"""
Usage Tracker Service
Tracks per-tenant resource consumption:
- Messages sent/received
- LLM tokens used
- API calls
- Estimated costs
"""
import structlog
from datetime import datetime

logger = structlog.get_logger()


class UsageTracker:
    """Tracks and records usage metrics per tenant."""

    def __init__(self, db_pool):
        self.db = db_pool

    def _get_period_start(self):
        """Get the start of the current billing period (1st of month)."""
        now = datetime.utcnow()
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    async def track_message(self, tenant_id: int, direction: str = "sent"):
        """Track a message sent or received."""
        period_start = self._get_period_start()
        period_end = period_start.replace(month=period_start.month % 12 + 1) if period_start.month < 12 else period_start.replace(year=period_start.year + 1, month=1)

        col = "messages_sent" if direction == "sent" else "messages_received"

        await self.db.execute(f"""
            INSERT INTO usage_records (tenant_id, period_start, period_end, {col})
            VALUES ($1, $2, $3, 1)
            ON CONFLICT (tenant_id, period_start) DO UPDATE
            SET {col} = usage_records.{col} + 1
        """, tenant_id, period_start, period_end)

    async def track_tokens(self, tenant_id: int, tokens: int, model: str = "gpt-4", cost_usd: float = 0.0):
        """Track LLM token usage and cost."""
        period_start = self._get_period_start()
        period_end = period_start.replace(month=period_start.month % 12 + 1) if period_start.month < 12 else period_start.replace(year=period_start.year + 1, month=1)

        await self.db.execute("""
            INSERT INTO usage_records (tenant_id, period_start, period_end, tokens_used, llm_cost_usd)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (tenant_id, period_start) DO UPDATE
            SET tokens_used = usage_records.tokens_used + $4,
                llm_cost_usd = usage_records.llm_cost_usd + $5
        """, tenant_id, period_start, period_end, tokens, cost_usd)

    async def track_api_call(self, tenant_id: int):
        """Track an API call."""
        period_start = self._get_period_start()
        period_end = period_start.replace(month=period_start.month % 12 + 1) if period_start.month < 12 else period_start.replace(year=period_start.year + 1, month=1)

        await self.db.execute("""
            INSERT INTO usage_records (tenant_id, period_start, period_end, api_calls)
            VALUES ($1, $2, $3, 1)
            ON CONFLICT (tenant_id, period_start) DO UPDATE
            SET api_calls = usage_records.api_calls + 1
        """, tenant_id, period_start, period_end)

    async def check_limits(self, tenant_id: int) -> dict:
        """Check if tenant is within plan limits."""
        period_start = self._get_period_start()

        row = await self.db.fetchrow("""
            SELECT
                COALESCE(u.messages_sent, 0) as messages_used,
                COALESCE(u.tokens_used, 0) as tokens_used,
                p.max_messages_per_month,
                p.max_tokens_per_month,
                p.name as plan_name
            FROM subscriptions s
            JOIN plans p ON p.id = s.plan_id
            LEFT JOIN usage_records u ON u.tenant_id = s.tenant_id AND u.period_start = $2
            WHERE s.tenant_id = $1
        """, tenant_id, period_start)

        if not row:
            return {"allowed": False, "reason": "no_subscription"}

        # -1 means unlimited
        messages_ok = row["max_messages_per_month"] == -1 or row["messages_used"] < row["max_messages_per_month"]
        tokens_ok = row["max_tokens_per_month"] == -1 or row["tokens_used"] < row["max_tokens_per_month"]

        return {
            "allowed": messages_ok and tokens_ok,
            "messages_used": row["messages_used"],
            "messages_limit": row["max_messages_per_month"],
            "tokens_used": row["tokens_used"],
            "tokens_limit": row["max_tokens_per_month"],
            "plan": row["plan_name"],
            "messages_exceeded": not messages_ok,
            "tokens_exceeded": not tokens_ok
        }


# Global instance (initialized on startup)
usage_tracker: UsageTracker | None = None


def init_usage_tracker(db_pool):
    """Initialize the global usage tracker."""
    global usage_tracker
    usage_tracker = UsageTracker(db_pool)
    return usage_tracker


def get_usage_tracker() -> UsageTracker:
    """Get the global usage tracker instance."""
    if usage_tracker is None:
        raise RuntimeError("UsageTracker not initialized")
    return usage_tracker
