import os
import base64
import hashlib
from itertools import cycle
from typing import Optional

# Encryption Helper
# WARNING: XOR encryption is weak. Consider migrating to Fernet for production.
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "")
FERNET_PREFIX = "FERNET:"
XOR_PREFIX = "XOR:"  # optional, not used for legacy data

# Fernet encryption support
_FERNET_INSTANCE = None


def _get_fernet():
    """Return a Fernet instance derived from ENCRYPTION_KEY, or None if cryptography not available."""
    global _FERNET_INSTANCE
    if _FERNET_INSTANCE is not None:
        return _FERNET_INSTANCE
    if not ENCRYPTION_KEY:
        return None
    try:
        from cryptography.fernet import Fernet

        # Derive a 32-byte url-safe base64 key from ENCRYPTION_KEY using SHA256
        key = hashlib.sha256(ENCRYPTION_KEY.encode()).digest()
        fernet_key = base64.urlsafe_b64encode(key)
        _FERNET_INSTANCE = Fernet(fernet_key)
        return _FERNET_INSTANCE
    except ImportError:
        # cryptography not installed; Fernet encryption unavailable
        return None


def encrypt_password(password: str) -> str:
    """Encrypt with Fernet (AES-128) and prefix with FERNET:, fallback to XOR if Fernet unavailable."""
    if not password or not ENCRYPTION_KEY:
        return password or ""
    fernet = _get_fernet()
    if fernet is not None:
        # Use Fernet encryption
        encrypted = fernet.encrypt(password.encode()).decode()
        return FERNET_PREFIX + encrypted
    # Fallback to XOR (legacy)
    data_bytes = password.encode("utf-8")
    key_bytes = ENCRYPTION_KEY.encode("utf-8")
    xored = bytes(b ^ k for b, k in zip(data_bytes, cycle(key_bytes)))
    return base64.b64encode(xored).decode("utf-8")


def decrypt_password(encrypted: str) -> str:
    """Decrypt Fernet (prefixed with FERNET:) or fallback to XOR (legacy)."""
    if not encrypted or not ENCRYPTION_KEY:
        return encrypted or ""
    # Check for Fernet prefix
    if encrypted.startswith(FERNET_PREFIX):
        fernet = _get_fernet()
        if fernet is not None:
            try:
                ciphertext = encrypted[len(FERNET_PREFIX) :]
                decrypted = fernet.decrypt(ciphertext.encode()).decode()
                return decrypted
            except Exception:
                # Fernet decryption failed; fallback to XOR attempt
                pass
    # Attempt XOR decryption (legacy format)
    try:
        data_bytes = base64.b64decode(encrypted)
        key_bytes = ENCRYPTION_KEY.encode("utf-8")
        xored = bytes(b ^ k for b, k in zip(data_bytes, cycle(key_bytes)))
        return xored.decode("utf-8")
    except Exception:
        # Fallback for plain text or older/incompatible formats
        return encrypted
