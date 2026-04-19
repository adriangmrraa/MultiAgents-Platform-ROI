from datetime import datetime, timedelta
from typing import Any, Union
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15  # 15 minutes
REFRESH_TOKEN_EXPIRE_DAYS = 7  # 7 days
REFRESH_TOKEN_FAMILY_SIZE = 5  # Max refresh tokens per family


def create_access_token(
    subject: Union[str, Any], expires_delta: timedelta = None
) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {"exp": expire, "sub": str(subject), "tv": 2}
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY.get_secret_value(), algorithm=ALGORITHM
    )
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_refresh_token(subject: Union[str, Any], family_id: str = None) -> str:
    """
     Crea un refresh token con tiempo de expiración largo.
    family_id: Identificador de la familia de tokens (agrupación para revocación en cadena)
    """
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "tv": 2,  # Token version 2
        "type": "refresh",
    }

    if family_id:
        to_encode["family"] = family_id

    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY.get_secret_value(), algorithm=ALGORITHM
    )
    return encoded_jwt


def hash_token(token: str) -> str:
    """
    Genera un hash SHA-256 del token para almacenamiento en Redis.
    Útil para almacenar tokens de forma segura sin exponer el token real.
    """
    import hashlib

    return hashlib.sha256(token.encode()).hexdigest()
