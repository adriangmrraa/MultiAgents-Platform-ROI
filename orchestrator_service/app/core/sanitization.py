import html
import re
from typing import Any, Union, Dict, List
from functools import wraps


def sanitize_html(value: str) -> str:
    """Escape HTML characters to prevent XSS."""
    return html.escape(value)


def sanitize_sql_identifier(identifier: str) -> str:
    """Sanitize a SQL identifier (table name, column name). Raises ValueError if invalid."""
    if not identifier:
        raise ValueError("Empty SQL identifier")
    cleaned = re.sub(r'[^a-zA-Z0-9_]', '', identifier)
    if cleaned != identifier:
        raise ValueError(f"Invalid SQL identifier: {identifier}")
    return identifier


def sanitize_path(value: str) -> str:
    """Prevent path traversal attacks.

    Removes '../' and '..\\' sequences.
    """
    value = value.replace("../", "").replace("..\\", "")
    # Also remove any attempts with encoded slashes
    value = value.replace("%2e%2e%2f", "").replace("%2e%2e/", "")
    return value


def _sanitize_recursive(obj: Any) -> Any:
    """Recursively sanitize strings in a data structure."""
    if isinstance(obj, str):
        return sanitize_html(obj)
    elif isinstance(obj, dict):
        return {k: _sanitize_recursive(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_sanitize_recursive(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(_sanitize_recursive(item) for item in obj)
    else:
        return obj


def sanitize_response(func):
    """Decorator to sanitize all strings in the response of an async function."""

    @wraps(func)
    async def wrapper(*args, **kwargs):
        result = await func(*args, **kwargs)
        return _sanitize_recursive(result)

    return wrapper
