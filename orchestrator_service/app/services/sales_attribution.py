"""
Sales Attribution Service (ROI Real v8.0)
Attributes Tienda Nube orders to AI agent conversations.

Attribution methods (in priority order):
1. phone_match  (confidence=1.0) - WhatsApp: exact phone match
2. utm_tracking (confidence=0.9) - FB/IG: conversation_id in UTM params
3. email_match  (confidence=0.5) - Fallback: email + time window
"""

import re
import os
import json
import structlog
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse, parse_qs

from db import db

logger = structlog.get_logger()

ATTRIBUTION_WINDOW_HOURS = int(os.getenv("ATTRIBUTION_WINDOW_HOURS", "168"))  # 7 days
ATTRIBUTION_EMAIL_WINDOW_HOURS = int(os.getenv("ATTRIBUTION_EMAIL_WINDOW_HOURS", "48"))
UTM_SOURCE_TAG = os.getenv("UTM_SOURCE_TAG", "nexus_ai")


def normalize_phone(phone: str) -> str:
    """
    Normalize phone number to E.164 format for Argentina.
    Handles: +54 9 11 1234-5678, 011-1234-5678, 5491112345678, 15-1234-5678
    Returns: +5491112345678
    """
    if not phone:
        return ""

    digits = re.sub(r'[^\d]', '', phone)

    if not digits:
        return ""

    # Remove international prefix 54
    if digits.startswith('54'):
        digits = digits[2:]

    # Remove mobile 9 prefix
    if digits.startswith('9') and len(digits) >= 10:
        digits = digits[1:]

    # Remove area code leading 0
    if digits.startswith('0'):
        digits = digits[1:]

    # Handle old-style 15 prefix (Buenos Aires mobile)
    if digits.startswith('15') and len(digits) == 10:
        digits = '11' + digits[2:]

    # Validate minimum length
    if len(digits) < 8:
        return f"+{phone.strip()}"  # Return as-is if can't normalize

    return f'+549{digits}'


def parse_utm_from_url(url: str) -> Dict[str, str]:
    """Extract UTM parameters from a URL."""
    if not url:
        return {}
    try:
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        return {
            "utm_source": params.get("utm_source", [""])[0],
            "utm_medium": params.get("utm_medium", [""])[0],
            "utm_campaign": params.get("utm_campaign", [""])[0],
            "utm_content": params.get("utm_content", [""])[0],
        }
    except Exception:
        return {}


class SalesAttributionService:
    """Handles attribution of Tienda Nube orders to AI agent conversations."""

    @staticmethod
    async def attribute_order(tenant_id: int, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Attempt to attribute an order to an AI agent conversation.

        Returns attribution result dict with method, confidence, conversation_id, etc.
        Returns None values if no attribution found.
        """
        result = {
            "conversation_id": None,
            "customer_id": None,
            "channel_source": None,
            "attribution_method": None,
            "attribution_confidence": 0.0,
            "attribution_details": {},
        }

        customer_phone = order_data.get("customer_phone", "")
        customer_email = order_data.get("customer_email", "")
        landing_url = order_data.get("landing_url", "")
        order_created = order_data.get("order_created_at")

        # --- Method 1: Phone Match (WhatsApp) ---
        if customer_phone:
            phone_result = await SalesAttributionService._try_phone_match(
                tenant_id, customer_phone, order_created
            )
            if phone_result:
                return phone_result

        # --- Method 2: UTM Tracking (Facebook/Instagram) ---
        if landing_url:
            utm_result = await SalesAttributionService._try_utm_match(
                tenant_id, landing_url
            )
            if utm_result:
                return utm_result

        # --- Method 3: Email Match (Fallback) ---
        if customer_email:
            email_result = await SalesAttributionService._try_email_match(
                tenant_id, customer_email, order_created
            )
            if email_result:
                return email_result

        return result

    @staticmethod
    async def _try_phone_match(
        tenant_id: int, phone: str, order_created: Optional[str]
    ) -> Optional[Dict]:
        """Match order phone with customer who chatted with AI agent."""
        normalized = normalize_phone(phone)
        if not normalized:
            return None

        # Also try without the +549 prefix for flexibility
        phone_variants = [normalized]
        digits_only = re.sub(r'[^\d]', '', normalized)
        if digits_only not in phone_variants:
            phone_variants.append(digits_only)

        window = datetime.now(timezone.utc) - timedelta(hours=ATTRIBUTION_WINDOW_HOURS)

        for phone_val in phone_variants:
            try:
                row = await db.pool.fetchrow("""
                    SELECT c.id as customer_id, conv.id as conversation_id,
                           conv.channel_source
                    FROM customers c
                    JOIN chat_conversations conv ON conv.customer_id = c.id
                    WHERE c.tenant_id = $1
                      AND (c.phone_number LIKE $2 OR c.phone_number LIKE $3)
                      AND conv.last_message_at >= $4
                      AND conv.tenant_id = $1
                    ORDER BY conv.last_message_at DESC
                    LIMIT 1
                """, tenant_id, f"%{phone_val[-10:]}%", phone_val, window)

                if row:
                    return {
                        "conversation_id": row["conversation_id"],
                        "customer_id": row["customer_id"],
                        "channel_source": row["channel_source"] or "whatsapp",
                        "attribution_method": "phone_match",
                        "attribution_confidence": 1.0,
                        "attribution_details": {
                            "matched_phone": phone_val,
                            "original_phone": phone,
                        },
                    }
            except Exception as e:
                logger.error("phone_match_query_failed", error=str(e), phone=phone_val[:5])

        return None

    @staticmethod
    async def _try_utm_match(tenant_id: int, landing_url: str) -> Optional[Dict]:
        """Match UTM campaign parameter (conversation_id) from landing URL."""
        utm = parse_utm_from_url(landing_url)

        if utm.get("utm_source") != UTM_SOURCE_TAG:
            return None

        campaign = utm.get("utm_campaign", "")
        if not campaign:
            return None

        # utm_campaign should be a conversation UUID
        try:
            row = await db.pool.fetchrow("""
                SELECT id, customer_id, channel_source
                FROM chat_conversations
                WHERE id = $1::uuid AND tenant_id = $2
            """, campaign, tenant_id)

            if row:
                channel = utm.get("utm_medium") or row["channel_source"] or "unknown"
                return {
                    "conversation_id": row["id"],
                    "customer_id": row["customer_id"],
                    "channel_source": channel,
                    "attribution_method": "utm_tracking",
                    "attribution_confidence": 0.9,
                    "attribution_details": {
                        "landing_url": landing_url,
                        "utm_params": utm,
                    },
                }
        except Exception as e:
            logger.debug("utm_match_query_failed", error=str(e), campaign=campaign[:20])

        return None

    @staticmethod
    async def _try_email_match(
        tenant_id: int, email: str, order_created: Optional[str]
    ) -> Optional[Dict]:
        """Match order email with customer who chatted recently."""
        window = datetime.now(timezone.utc) - timedelta(hours=ATTRIBUTION_EMAIL_WINDOW_HOURS)

        try:
            row = await db.pool.fetchrow("""
                SELECT c.id as customer_id, conv.id as conversation_id,
                       conv.channel_source
                FROM customers c
                JOIN chat_conversations conv ON conv.customer_id = c.id
                WHERE c.tenant_id = $1
                  AND LOWER(c.email) = LOWER($2)
                  AND conv.last_message_at >= $3
                  AND conv.tenant_id = $1
                ORDER BY conv.last_message_at DESC
                LIMIT 1
            """, tenant_id, email, window)

            if row:
                return {
                    "conversation_id": row["conversation_id"],
                    "customer_id": row["customer_id"],
                    "channel_source": row["channel_source"] or "unknown",
                    "attribution_method": "email_match",
                    "attribution_confidence": 0.5,
                    "attribution_details": {
                        "matched_email": email,
                    },
                }
        except Exception as e:
            logger.error("email_match_query_failed", error=str(e))

        return None

    @staticmethod
    async def process_and_store_order(tenant_id: int, order: Dict[str, Any]) -> bool:
        """
        Process a single order: store in attributed_sales and attempt attribution.
        Returns True if new order was stored, False if already existed.
        """
        order_id = str(order.get("id", ""))
        if not order_id:
            return False

        # Check if already processed
        existing = await db.pool.fetchval(
            "SELECT 1 FROM attributed_sales WHERE tenant_id = $1 AND order_id = $2",
            tenant_id, order_id
        )
        if existing:
            return False

        # Parse order_created_at
        order_created = order.get("created_at")
        order_dt = None
        if order_created:
            try:
                order_dt = datetime.fromisoformat(order_created.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                order_dt = datetime.now(timezone.utc)

        total = 0.0
        try:
            total = float(order.get("total", 0))
        except (ValueError, TypeError):
            pass

        # Attempt attribution
        attribution = await SalesAttributionService.attribute_order(tenant_id, {
            "customer_phone": order.get("customer_phone", ""),
            "customer_email": order.get("customer_email", ""),
            "landing_url": order.get("landing_url", ""),
            "order_created_at": order_created,
        })

        conv_id = attribution.get("conversation_id")
        attributed_at = datetime.now(timezone.utc) if conv_id else None

        try:
            await db.pool.execute("""
                INSERT INTO attributed_sales (
                    tenant_id, order_id, order_number, order_total, order_currency,
                    order_status, payment_status, order_created_at,
                    customer_phone, customer_email, customer_name,
                    conversation_id, customer_id, channel_source,
                    attribution_method, attribution_confidence, attribution_details,
                    attributed_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                    $12, $13, $14, $15, $16, $17, $18
                )
                ON CONFLICT (tenant_id, order_id) DO NOTHING
            """,
                tenant_id,
                order_id,
                order.get("number"),
                total,
                order.get("currency", "ARS"),
                order.get("status"),
                order.get("payment_status"),
                order_dt,
                order.get("customer_phone", ""),
                order.get("customer_email", ""),
                order.get("customer_name", ""),
                conv_id,
                attribution.get("customer_id"),
                attribution.get("channel_source"),
                attribution.get("attribution_method"),
                attribution.get("attribution_confidence", 0.0),
                json.dumps(attribution.get("attribution_details", {})),
                attributed_at,
            )
            if conv_id:
                logger.info("order_attributed",
                            tenant_id=tenant_id,
                            order_id=order_id,
                            method=attribution["attribution_method"],
                            confidence=attribution["attribution_confidence"],
                            channel=attribution.get("channel_source"))
            return True
        except Exception as e:
            logger.error("order_store_failed", error=str(e), order_id=order_id)
            return False
