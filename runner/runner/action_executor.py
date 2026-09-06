"""HTTP action executor with context template substitution."""

from __future__ import annotations

import json
import re
from typing import Any, Awaitable, Callable

import aiohttp

TEMPLATE_RE = re.compile(r"\{\{context\.([a-zA-Z_][a-zA-Z0-9_]*)\}\}")


def substitute_templates(value: Any, context_vars: dict[str, Any]) -> Any:
    if isinstance(value, str):
        def replacer(match: re.Match) -> str:
            key = match.group(1)
            return str(context_vars.get(key, ""))

        return TEMPLATE_RE.sub(replacer, value)
    if isinstance(value, dict):
        return {k: substitute_templates(v, context_vars) for k, v in value.items()}
    if isinstance(value, list):
        return [substitute_templates(v, context_vars) for v in value]
    return value


def _extract_path(data: Any, path: str) -> Any:
    current = data
    for part in path.split("."):
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


async def execute_action(
    config: dict[str, Any],
    context_vars: dict[str, Any],
    session: aiohttp.ClientSession | None = None,
) -> dict[str, Any]:
    url = config["url"]
    method = config.get("method", "GET").upper()
    body_template = config.get("body_template")
    result_mapping = config.get("result_mapping", {})

    owns_session = session is None
    if owns_session:
        session = aiohttp.ClientSession()

    try:
        kwargs: dict[str, Any] = {}
        if method == "POST" and body_template:
            body = substitute_templates(body_template, context_vars)
            kwargs["json"] = body

        async with session.request(method, url, **kwargs) as response:
            try:
                payload = await response.json()
            except (aiohttp.ContentTypeError, json.JSONDecodeError):
                payload = {"text": await response.text()}

        mapped: dict[str, Any] = {}
        for var_name, json_path in result_mapping.items():
            mapped[var_name] = _extract_path(payload, json_path)
        return mapped
    finally:
        if owns_session and session:
            await session.close()


ActionExecutor = Callable[[dict[str, Any], dict[str, Any]], Awaitable[dict[str, Any]]]
