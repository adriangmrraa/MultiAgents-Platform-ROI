import os
import base64
from itertools import cycle

# Simple Encryption Helper (Standard Lib only)
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "agente-js-secret-key-2024")

def encrypt_password(password: str) -> str:
    """Simple XOR + Base64 encryption (Byte-safe)."""
    if not password: return ""
    data_bytes = password.encode('utf-8')
    key_bytes = ENCRYPTION_KEY.encode('utf-8')
    xored = bytes(b ^ k for b, k in zip(data_bytes, cycle(key_bytes)))
    return base64.b64encode(xored).decode('utf-8')

def decrypt_password(encrypted: str) -> str:
    """Simple XOR + Base64 decryption (Byte-safe)."""
    if not encrypted: return ""
    try:
        data_bytes = base64.b64decode(encrypted)
        key_bytes = ENCRYPTION_KEY.encode('utf-8')
        xored = bytes(b ^ k for b, k in zip(data_bytes, cycle(key_bytes)))
        return xored.decode('utf-8')
    except Exception as e:
        # Fallback for plain text or older/incompatible formats
        return encrypted
