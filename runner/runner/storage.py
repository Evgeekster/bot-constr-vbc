"""Redis-backed scenario snapshot and user session storage."""

from __future__ import annotations

import json
from typing import Any

import redis.asyncio as aioredis


class ScenarioStorage:
    def __init__(self, redis_url: str, bot_id: int):
        self.bot_id = bot_id
        self._redis = aioredis.from_url(redis_url, decode_responses=True)

    async def close(self) -> None:
        await self._redis.aclose()

    async def get_scenario_version(self) -> int | None:
        value = await self._redis.get(f"bot:{self.bot_id}:scenario_version")
        return int(value) if value else None

    async def get_snapshot(self, version: int | None = None) -> dict | None:
        if version is None:
            version = await self.get_scenario_version()
        if version is None:
            return None
        raw = await self._redis.get(f"scenario:{self.bot_id}:{version}")
        if not raw:
            return None
        return json.loads(raw)

    def _session_key(self, user_id: int) -> str:
        return f"session:{self.bot_id}:{user_id}"

    async def get_context(self, user_id: int) -> dict[str, Any]:
        raw = await self._redis.get(self._session_key(user_id))
        if not raw:
            return {"current_node": "start", "vars": {}}
        return json.loads(raw)

    async def save_context(self, user_id: int, context: dict[str, Any]) -> None:
        await self._redis.set(self._session_key(user_id), json.dumps(context))

    async def clear_context(self, user_id: int) -> None:
        await self._redis.delete(self._session_key(user_id))
