"""Bot creation and Telegram token verification."""

from __future__ import annotations

import re
from typing import Any

import httpx
from django.db import transaction

from apps.bots.models import BotInstance
from apps.scenarios.models import Node, Scenario
from apps.scenarios.services.compiler import publish_to_redis
from apps.scenarios.tasks import get_redis_client

TOKEN_PATTERN = re.compile(r"^\d+:[A-Za-z0-9_-]{30,}$")


def verify_telegram_token(token: str) -> dict[str, Any] | None:
    """Validate token format and call Telegram getMe."""
    token = token.strip()
    if not TOKEN_PATTERN.match(token):
        return None

    try:
        response = httpx.get(
            f"https://api.telegram.org/bot{token}/getMe",
            timeout=10.0,
        )
        payload = response.json()
    except httpx.HTTPError:
        return None

    if not payload.get("ok"):
        return None
    return payload["result"]


@transaction.atomic
def bootstrap_new_bot(
    owner,
    name: str,
    token: str,
    is_active: bool = True,
) -> BotInstance:
    """Create bot, default scenario, and publish starter snapshot to Redis."""
    bot = BotInstance.objects.create(
        owner=owner,
        name=name,
        token=token,
        is_active=is_active,
    )

    scenario = Scenario.objects.create(
        bot=bot,
        name="Main",
        version=1,
        is_published=True,
    )
    Node.objects.create(
        scenario=scenario,
        key="start",
        type="message",
        config={"text": "Привет! Бот подключён и готов к работе."},
        position={"x": 100, "y": 80},
    )

    bot.default_scenario = scenario
    bot.save(update_fields=["default_scenario"])

    try:
        publish_to_redis(scenario, get_redis_client())
    except Exception as exc:
        raise RuntimeError(
            f"Бот создан, но не удалось опубликовать сценарий в Redis: {exc}"
        ) from exc

    return bot
