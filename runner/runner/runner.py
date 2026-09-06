#!/usr/bin/env python
"""Entry point for a single bot runner process."""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys

import aiohttp
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from runner.action_executor import execute_action
from runner.engine import ScenarioEngine
from runner.handlers import create_router
from runner.lock import UpdateLock
from runner.storage import ScenarioStorage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def run_bot(bot_id: int, token: str, redis_url: str) -> None:
    storage = ScenarioStorage(redis_url, bot_id)
    lock = UpdateLock(redis_url, bot_id)

    session = aiohttp.ClientSession()

    async def action_executor(config, context_vars):
        return await execute_action(config, context_vars, session=session)

    engine = ScenarioEngine(storage, action_executor=action_executor)
    router = create_router(engine, lock)

    bot = Bot(token=token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    dp.include_router(router)

    logger.info("Starting runner for bot_id=%s", bot_id)
    try:
        await dp.start_polling(bot)
    finally:
        await session.close()
        await storage.close()
        await lock.close()
        await bot.session.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a Telegram bot scenario runner")
    parser.add_argument("--bot-id", type=int, required=True)
    parser.add_argument("--token", type=str, default=os.environ.get("BOT_TOKEN"))
    parser.add_argument(
        "--redis-url",
        type=str,
        default=os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
    )
    args = parser.parse_args()

    if not args.token:
        logger.error("Bot token required via --token or BOT_TOKEN env")
        sys.exit(1)

    asyncio.run(run_bot(args.bot_id, args.token, args.redis_url))


if __name__ == "__main__":
    main()
