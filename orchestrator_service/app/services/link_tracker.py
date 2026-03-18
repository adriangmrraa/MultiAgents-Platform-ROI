"""
Link Tracker Service (ROI Real v8.0)
Injects UTM tracking parameters into Tienda Nube product links
when sent by AI agents on Facebook and Instagram channels.

WhatsApp links are NOT modified (attribution is via phone match).
"""

import re
import os
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

UTM_SOURCE_TAG = os.getenv("UTM_SOURCE_TAG", "nexus_ai")

# Regex to match Tienda Nube store URLs
TN_URL_PATTERN = re.compile(
    r'(https?://[^\s]*(?:mitiendanube\.com|nuvemshop\.com\.br|tiendanube\.com)[^\s]*)',
    re.IGNORECASE
)


def inject_tracking(url: str, conversation_id: str, channel: str, tenant_id: int) -> str:
    """
    Inject UTM parameters into a Tienda Nube product URL.

    Args:
        url: Original product URL
        conversation_id: UUID of the conversation (used as utm_campaign)
        channel: Channel source (facebook, instagram)
        tenant_id: Tenant ID (used as utm_content)

    Returns:
        URL with UTM parameters appended
    """
    try:
        parsed = urlparse(url)

        # Only inject on Tienda Nube domains
        host = parsed.hostname or ""
        if not any(domain in host for domain in ["mitiendanube.com", "nuvemshop.com.br", "tiendanube.com"]):
            return url

        # Parse existing query params
        existing_params = parse_qs(parsed.query, keep_blank_values=True)

        # Don't double-inject
        if "utm_source" in existing_params:
            return url

        # Build UTM params
        utm_params = {
            "utm_source": UTM_SOURCE_TAG,
            "utm_medium": channel,
            "utm_campaign": str(conversation_id),
            "utm_content": str(tenant_id),
        }

        # Merge with existing params
        if parsed.query:
            new_query = f"{parsed.query}&{urlencode(utm_params)}"
        else:
            new_query = urlencode(utm_params)

        # Reconstruct URL
        new_parsed = parsed._replace(query=new_query)
        return urlunparse(new_parsed)

    except Exception:
        return url  # Never break the link


def inject_tracking_in_text(
    text: str,
    conversation_id: str,
    channel: str,
    tenant_id: int
) -> str:
    """
    Find all Tienda Nube URLs in a text and inject UTM tracking params.
    Only modifies URLs matching TN domains.

    Args:
        text: Full message text from AI agent
        conversation_id: UUID of the conversation
        channel: Channel source (facebook, instagram)
        tenant_id: Tenant ID

    Returns:
        Text with tracked URLs
    """
    if not text or channel not in ("facebook", "instagram"):
        return text

    def replace_url(match):
        original_url = match.group(0)
        return inject_tracking(original_url, conversation_id, channel, tenant_id)

    return TN_URL_PATTERN.sub(replace_url, text)
