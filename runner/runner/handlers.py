"""Aiogram handlers for scenario bot."""

from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message

from runner.engine import ScenarioEngine
from runner.lock import UpdateLock

router = Router()


def _build_menu_keyboard(menu_config: dict) -> InlineKeyboardMarkup:
    buttons = []
    for btn in menu_config.get("buttons", []):
        callback = btn["callback"]
        buttons.append([
            InlineKeyboardButton(
                text=btn["text"],
                callback_data=f"s:{callback}",
            )
        ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


async def _send_output(message: Message, output) -> None:
    for msg in output.messages:
        text = msg.get("text", "")
        media_url = msg.get("media_url")
        if media_url:
            await message.answer_photo(photo=media_url, caption=text or None)
        elif text:
            await message.answer(text)

    if output.question:
        await message.answer(output.question.get("prompt", ""))

    if output.menu:
        await message.answer(
            output.menu.get("text", ""),
            reply_markup=_build_menu_keyboard(output.menu),
        )


def create_router(engine: ScenarioEngine, lock: UpdateLock) -> Router:
    r = Router()

    @r.message(Command("start"))
    async def cmd_start(message: Message) -> None:
        user_id = message.from_user.id
        if not await lock.acquire(user_id):
            return
        try:
            output = await engine.start(user_id)
            await _send_output(message, output)
        finally:
            await lock.release(user_id)

    @r.callback_query(F.data.startswith("s:"))
    async def on_callback(query: CallbackQuery) -> None:
        user_id = query.from_user.id
        if not await lock.acquire(user_id):
            await query.answer("Подождите...")
            return
        try:
            value = query.data.removeprefix("s:")
            output = await engine.handle_callback(user_id, value)
            await query.answer()
            if query.message:
                await _send_output(query.message, output)
        finally:
            await lock.release(user_id)

    @r.message(F.text)
    async def on_text(message: Message) -> None:
        user_id = message.from_user.id
        if not await lock.acquire(user_id):
            return
        try:
            output = await engine.handle_text(user_id, message.text or "")
            await _send_output(message, output)
        finally:
            await lock.release(user_id)

    return r
