"""Scenario execution engine — reads Redis snapshots, resolves transitions."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

from simpleeval import SimpleEval

from runner.action_executor import ActionExecutor
from runner.storage import ScenarioStorage

WAITING_TYPES = {"question", "menu", "delay"}
PASS_THROUGH_TYPES = {"message", "action", "condition", "subscenario"}


@dataclass
class EngineOutput:
    messages: list[dict[str, Any]] = field(default_factory=list)
    menu: dict[str, Any] | None = None
    question: dict[str, Any] | None = None
    waiting: bool = False
    current_node: str = "start"


class ScenarioEngine:
    def __init__(
        self,
        storage: ScenarioStorage,
        action_executor: ActionExecutor | None = None,
    ):
        self.storage = storage
        self.action_executor = action_executor

    async def start(self, user_id: int) -> EngineOutput:
        context = await self.storage.get_context(user_id)
        context["current_node"] = "start"
        context.setdefault("vars", {})
        await self.storage.save_context(user_id, context)
        return await self._run_from(user_id, "start")

    async def handle_callback(self, user_id: int, callback_value: str) -> EngineOutput:
        context = await self.storage.get_context(user_id)
        current = context.get("current_node", "start")
        snapshot = await self._get_snapshot()
        if not snapshot:
            return EngineOutput(waiting=True, current_node=current)

        next_key = self._resolve_transition(
            snapshot, current, trigger="callback", value=callback_value, context=context
        )
        if not next_key:
            return EngineOutput(waiting=True, current_node=current)

        context["current_node"] = next_key
        await self.storage.save_context(user_id, context)
        return await self._run_from(user_id, next_key)

    async def handle_text(self, user_id: int, text: str) -> EngineOutput:
        context = await self.storage.get_context(user_id)
        current = context.get("current_node", "start")
        snapshot = await self._get_snapshot()
        if not snapshot:
            return EngineOutput(waiting=True, current_node=current)

        node = snapshot["nodes"].get(current, {})
        if node.get("type") == "question":
            var_name = node["config"]["var_name"]
            if not self._validate_answer(text, node["config"].get("validation", "any")):
                return EngineOutput(
                    messages=[{"text": "Неверный формат ответа. Попробуйте ещё раз."}],
                    question=node["config"],
                    waiting=True,
                    current_node=current,
                )
            context.setdefault("vars", {})[var_name] = text

        next_key = self._resolve_transition(
            snapshot, current, trigger="text", value=text, context=context
        )
        if not next_key and node.get("type") == "question":
            next_key = self._resolve_transition(
                snapshot, current, trigger="always", value=None, context=context
            )
        if not next_key:
            return EngineOutput(waiting=True, current_node=current)

        context["current_node"] = next_key
        await self.storage.save_context(user_id, context)
        return await self._run_from(user_id, next_key)

    async def _run_from(self, user_id: int, node_key: str) -> EngineOutput:
        output = EngineOutput(current_node=node_key)
        snapshot = await self._get_snapshot()
        if not snapshot:
            output.waiting = True
            return output

        context = await self.storage.get_context(user_id)
        current = node_key

        while current:
            node = snapshot["nodes"].get(current)
            if not node:
                break

            node_type = node["type"]
            config = node.get("config", {})

            if node_type == "message":
                msg: dict[str, Any] = {"text": config.get("text", "")}
                if config.get("media_url"):
                    msg["media_url"] = config["media_url"]
                output.messages.append(msg)

            elif node_type == "action" and self.action_executor:
                mapped = await self.action_executor(config, context.get("vars", {}))
                context.setdefault("vars", {}).update(mapped)
                await self.storage.save_context(user_id, context)

            elif node_type == "condition":
                next_key = self._resolve_transition(
                    snapshot, current, trigger="condition", value=None, context=context
                )
                if not next_key:
                    next_key = self._resolve_transition(
                        snapshot, current, trigger="always", value=None, context=context
                    )
                if next_key:
                    current = next_key
                    context["current_node"] = current
                    await self.storage.save_context(user_id, context)
                    continue
                break

            elif node_type == "delay":
                output.waiting = True
                output.current_node = current
                context["current_node"] = current
                await self.storage.save_context(user_id, context)
                return output

            elif node_type == "question":
                output.question = config
                output.waiting = True
                output.current_node = current
                context["current_node"] = current
                await self.storage.save_context(user_id, context)
                return output

            elif node_type == "menu":
                output.menu = config
                output.waiting = True
                output.current_node = current
                context["current_node"] = current
                await self.storage.save_context(user_id, context)
                return output

            elif node_type == "subscenario":
                pass

            next_key = self._resolve_transition(
                snapshot, current, trigger="always", value=None, context=context
            )
            if not next_key:
                break
            current = next_key
            context["current_node"] = current
            await self.storage.save_context(user_id, context)

        output.current_node = context.get("current_node", node_key)
        return output

    async def _get_snapshot(self) -> dict | None:
        return await self.storage.get_snapshot()

    def _resolve_transition(
        self,
        snapshot: dict,
        from_key: str,
        trigger: str,
        value: str | None,
        context: dict,
    ) -> str | None:
        transitions = snapshot.get("transitions", {}).get(from_key, [])
        candidates = []

        for t in transitions:
            t_trigger = t["trigger"]
            if t_trigger == "condition":
                expr = t.get("condition_expr")
                if expr and self._eval_condition(expr, context):
                    candidates.append(t)
            elif t_trigger == trigger:
                if trigger in ("always", "condition"):
                    candidates.append(t)
                elif t.get("value") == value:
                    candidates.append(t)

        if not candidates and trigger != "always":
            for t in transitions:
                if t["trigger"] == "always":
                    candidates.append(t)

        if not candidates:
            return None

        if trigger == "condition":
            candidates.sort(key=lambda x: x.get("priority", 0), reverse=True)
        else:
            candidates.sort(key=lambda x: x.get("priority", 0))
        return candidates[0]["to"]

    def _eval_condition(self, expr: str, context: dict) -> bool:
        try:
            evaluator = SimpleEval(names={"context": context.get("vars", {})})
            return bool(evaluator.eval(expr))
        except Exception:
            return False

    def _validate_answer(self, text: str, validation: str) -> bool:
        import re

        if validation == "any":
            return bool(text.strip())
        if validation == "number":
            return bool(re.match(r"^-?\d+(\.\d+)?$", text.strip()))
        if validation == "phone":
            return bool(re.match(r"^\+?\d{10,15}$", text.strip()))
        if validation == "email":
            return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", text.strip()))
        return True
