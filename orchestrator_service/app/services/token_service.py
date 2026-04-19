"""
Token Service - Refresh Token Rotation
Manejo de пары access + refresh tokens con rotación y revocación en cadena.
"""

import uuid
import structlog
from datetime import datetime, timedelta
from typing import Tuple, Optional
import redis.asyncio as aioredis

from app.core import security
from db import redis_client

logger = structlog.get_logger()

# TTL para tokens en Redis (7 días = 604800 segundos)
REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60


class TokenService:
    """
    Servicio para manejo de refresh token rotation.

    Estructura Redis:
    - rt:{hash}: Datos del refresh token (metadata, familia)
    - rt_family:{family_id}: Contador de tokens activos en la familia
    - rt_user:{user_id}: Set de todos los refresh tokens activos del usuario
    - rt_replay:{user_id}: Timestamp del último uso (anti-replay)
    """

    def __init__(self, redis: aioredis.Redis = None):
        self.redis = redis or redis_client

    async def create_token_pair(self, user_id: str) -> Tuple[str, str, str]:
        """
        Crea un пар de tokens (access + refresh) con familia asociada.

        Returns:
            Tuple[access_token, refresh_token, family_id]
        """
        # Generar ID de familia (nuevo en cada login)
        family_id = str(uuid.uuid4())

        # Crear refresh token con family_id
        refresh_token = security.create_refresh_token(user_id, family_id)
        refresh_hash = security.hash_token(refresh_token)

        # Crear access token
        access_token = security.create_access_token(user_id)

        # Almacenar refresh token en Redis
        await self._store_refresh_token(refresh_hash, user_id, family_id)

        logger.info("token_pair_created", user_id=user_id, family_id=family_id)

        return access_token, refresh_token, family_id

    async def refresh_tokens(self, refresh_token: str) -> Tuple[str, str, str]:
        """
        Refresca el пар de tokens usando un refresh token válido.

        Implementa:
        - Rotación: genera nuevo refresh token
        - Detección de replay: marca el token como usado
        - Familia: mantiene el family_id para permitir revocación en cadena

        Returns:
            Tuple[new_access_token, new_refresh_token, family_id]

        Raises:
            HTTPException(401) si el token es inválido, expirado, o detectado como replay
        """
        # Verificar y decodificar el refresh token
        try:
            payload = security.jwt.decode(
                refresh_token,
                security.settings.SECRET_KEY.get_secret_value(),
                algorithms=[security.ALGORITHM],
            )
        except Exception as e:
            logger.warning("refresh_token_invalid", error=str(e))
            raise ValueError("Invalid refresh token")

        # Validar que es un refresh token
        if payload.get("type") != "refresh":
            logger.warning("refresh_token_wrong_type")
            raise ValueError("Not a refresh token")

        # Validar versión del token
        if payload.get("tv") != 2:
            logger.warning("refresh_token_old_version", tv=payload.get("tv"))
            raise ValueError("Token version not supported")

        user_id = payload.get("sub")
        family_id = payload.get("family")
        token_exp = payload.get("exp")

        if not user_id or not family_id:
            logger.warning("refresh_token_missing_claims")
            raise ValueError("Invalid token payload")

        # Token replay detection: verificar que no haya sido usado recientemente
        replay_key = f"rt_replay:{user_id}"
        last_used = await self.redis.get(replay_key)

        if last_used:
            # Verificar si el token fue usado después del último refresh
            # Usamos el hash del token para сравнение
            current_hash = security.hash_token(refresh_token)
            used_tokens_key = f"rt_used:{user_id}"
            is_used = await self.redis.sismember(used_tokens_key, current_hash)

            if is_used:
                logger.critical(
                    "refresh_token_replay_attack", user_id=user_id, family_id=family_id
                )
                # Revocar toda la familia por seguridad
                await self.revoke_family(family_id)
                raise ValueError("Token replay detected - family revoked")

        # Marcar el token actual como usado (para replay detection)
        current_hash = security.hash_token(refresh_token)
        used_tokens_key = f"rt_used:{user_id}"
        await self.redis.sadd(used_tokens_key, current_hash)
        await self.redis.expire(used_tokens_key, REFRESH_TOKEN_TTL_SECONDS)

        # Actualizar timestamp de último uso
        await self.redis.set(replay_key, datetime.utcnow().isoformat())
        await self.redis.expire(replay_key, REFRESH_TOKEN_TTL_SECONDS)

        # Revocar el token antiguo (rotación)
        await self.revoke_token(refresh_token)

        # Generar nuevo пар de tokens
        new_access_token = security.create_access_token(user_id)
        new_refresh_token = security.create_refresh_token(user_id, family_id)

        # Almacenar el nuevo refresh token
        new_hash = security.hash_token(new_refresh_token)
        await self._store_refresh_token(new_hash, user_id, family_id)

        logger.info("tokens_rotated", user_id=user_id, family_id=family_id)

        return new_access_token, new_refresh_token, family_id

    async def revoke_token(self, refresh_token: str) -> bool:
        """
        Revoca un refresh token específico.
        """
        token_hash = security.hash_token(refresh_token)
        key = f"rt:{token_hash}"

        # Obtener datos antes de borrar
        token_data = await self.redis.hgetall(key)

        if token_data:
            user_id = token_data.get("user_id")
            family_id = token_data.get("family_id")

            # Eliminar el token
            await self.redis.delete(key)

            # Actualizar contador de familia
            if family_id:
                family_key = f"rt_family:{family_id}"
                count = await self.redis.decr(family_key)
                logger.info(
                    "refresh_token_revoked",
                    user_id=user_id,
                    family_id=family_id,
                    remaining=count,
                )

            # Remover del set de tokens del usuario
            if user_id:
                user_tokens_key = f"rt_user:{user_id}"
                await self.redis.srem(user_tokens_key, token_hash)

            return True

        return False

    async def revoke_family(self, family_id: str) -> bool:
        """
        Revoca toda una familia de refresh tokens (todos los tokens de una sesión).
        """
        family_key = f"rt_family:{family_id}"

        # Obtener el contador para saber cuántos tokens había
        count = await self.redis.get(family_key)
        count = int(count) if count else 0

        # Buscar y revocar todos los tokens de la familia
        # Nota: Como no almacenamos lista de tokens por familia,
        # necesitamos buscar por el prefijo en rt_user keys
        # Por eficiencia,marcaremos la familia como revocada

        await self.redis.set(f"rt_family_revoked:{family_id}", "1")
        await self.redis.expire(
            f"rt_family_revoked:{family_id}", REFRESH_TOKEN_TTL_SECONDS
        )

        # Eliminar contador de familia
        await self.redis.delete(family_key)

        logger.warning(
            "refresh_token_family_revoked", family_id=family_id, tokens_count=count
        )

        return True

    async def revoke_all_user_tokens(self, user_id: str) -> bool:
        """
        Revoca todos los refresh tokens activos de un usuario (logout global).
        """
        user_tokens_key = f"rt_user:{user_id}"

        # Obtener todos los hashes de tokens del usuario
        token_hashes = await self.redis.smembers(user_tokens_key)

        if token_hashes:
            # Revocar cada token
            for token_hash in token_hashes:
                key = f"rt:{token_hash}"
                token_data = await self.redis.hgetall(key)
                if token_data:
                    family_id = token_data.get("family_id")
                    if family_id:
                        # Decrementar contador de familia
                        family_key = f"rt_family:{family_id}"
                        await self.redis.decr(family_key)

                await self.redis.delete(key)

            # Limpiar set de tokens del usuario
            await self.redis.delete(user_tokens_key)

            logger.info(
                "all_user_tokens_revoked", user_id=user_id, count=len(token_hashes)
            )

        # Limpiar también el replay key
        await self.redis.delete(f"rt_replay:{user_id}")

        return True

    async def _store_refresh_token(
        self, token_hash: str, user_id: str, family_id: str
    ) -> None:
        """
        Almacena metadatos del refresh token en Redis.
        """
        key = f"rt:{token_hash}"

        # Almacenar metadatos
        await self.redis.hset(
            key,
            mapping={
                "user_id": user_id,
                "family_id": family_id,
                "created_at": datetime.utcnow().isoformat(),
            },
        )
        await self.redis.expire(key, REFRESH_TOKEN_TTL_SECONDS)

        # Agregar al set de tokens del usuario
        user_tokens_key = f"rt_user:{user_id}"
        await self.redis.sadd(user_tokens_key, token_hash)
        await self.redis.expire(user_tokens_key, REFRESH_TOKEN_TTL_SECONDS)

        # Incrementar contador de familia
        family_key = f"rt_family:{family_id}"
        await self.redis.incr(family_key)
        await self.redis.expire(family_key, REFRESH_TOKEN_TTL_SECONDS)

    async def is_token_valid(self, refresh_token: str) -> bool:
        """
        Verifica si un refresh token es válido y no ha sido revocado.
        """
        try:
            # Verificar firma
            payload = security.jwt.decode(
                refresh_token,
                security.settings.SECRET_KEY.get_secret_value(),
                algorithms=[security.ALGORITHM],
            )

            if payload.get("type") != "refresh" or payload.get("tv") != 2:
                return False

            # Verificar que no esté revocado
            token_hash = security.hash_token(refresh_token)
            key = f"rt:{token_hash}"

            return await self.redis.exists(key) > 0

        except Exception:
            return False


# Instancia global del servicio
token_service = TokenService()
