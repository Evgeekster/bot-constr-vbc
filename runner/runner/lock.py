"""Redis distributed lock for update processing."""

from __future__ import annotations

import redis.asyncio as aioredis


class UpdateLock:
    def __init__(self, redis_url: str, bot_id: int, ttl_seconds: int = 5):
        self._redis = aioredis.from_url(redis_url, decode_responses=True)
        self.bot_id = bot_id
        self.ttl_seconds = ttl_seconds

    def _key(self, user_id: int) -> str:
        return f"lock:{self.bot_id}:{user_id}"

    async def acquire(self, user_id: int) -> bool:
        return bool(
            await self._redis.set(self._key(user_id), "1", nx=True, ex=self.ttl_seconds)
        )

    async def release(self, user_id: int) -> None:
        await self._redis.delete(self._key(user_id))

    async def close(self) -> None:
        await self._redis.aclose()
