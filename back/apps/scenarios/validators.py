import re

from django.core.exceptions import ValidationError
from rest_framework import serializers
from simpleeval import SimpleEval

FAKE_CONTEXT = {
    "context": {
        "var": 1,
        "name": "test",
        "phone": "+79990000000",
        "email": "test@example.com",
    }
}


def validate_condition_expr(expr: str) -> None:
    if not expr or not expr.strip():
        raise serializers.ValidationError("Выражение условия не может быть пустым")
    try:
        evaluator = SimpleEval(names=FAKE_CONTEXT)
        evaluator.eval(expr)
    except Exception as exc:
        raise serializers.ValidationError(f"Синтаксическая ошибка в условии: {exc}") from exc


def validate_node_config(node_type: str, config: dict) -> dict:
    if config is None:
        config = {}

    if node_type == "message":
        text = config.get("text")
        if not text or not str(text).strip():
            raise serializers.ValidationError({"config": "text обязателен"})
        media_url = config.get("media_url")
        if media_url:
            if not str(media_url).startswith(("http://", "https://")):
                raise serializers.ValidationError({"config": "media_url: некорректный URL"})
        return {"text": str(text), **({"media_url": media_url} if media_url else {})}

    if node_type == "question":
        prompt = config.get("prompt")
        var_name = config.get("var_name")
        if not prompt or not str(prompt).strip():
            raise serializers.ValidationError({"config": "prompt обязателен"})
        if not var_name or not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", str(var_name)):
            raise serializers.ValidationError({"config": "var_name: только латиница, цифры и _"})
        validation = config.get("validation", "any")
        if validation not in ("any", "number", "phone", "email"):
            raise serializers.ValidationError({"config": "validation: неверное значение"})
        return {"prompt": str(prompt), "var_name": str(var_name), "validation": validation}

    if node_type == "menu":
        text = config.get("text")
        buttons = config.get("buttons", [])
        if not text or not str(text).strip():
            raise serializers.ValidationError({"config": "text обязателен"})
        if not buttons:
            raise serializers.ValidationError({"config": "Добавьте хотя бы одну кнопку"})
        validated_buttons = []
        for i, btn in enumerate(buttons):
            btn_text = btn.get("text")
            callback = btn.get("callback")
            if not btn_text:
                raise serializers.ValidationError({"config": f"buttons[{i}].text обязателен"})
            if not callback or not re.match(r"^[a-zA-Z0-9_-]+$", str(callback)):
                raise serializers.ValidationError({"config": f"buttons[{i}].callback: неверный формат"})
            validated_buttons.append({"text": str(btn_text), "callback": str(callback)})
        return {"text": str(text), "buttons": validated_buttons}

    if node_type == "condition":
        return {}

    if node_type == "action":
        url = config.get("url")
        method = config.get("method")
        if not url:
            raise serializers.ValidationError({"config": "url обязателен"})
        if method not in ("GET", "POST"):
            raise serializers.ValidationError({"config": "method: GET или POST"})
        result_mapping = config.get("result_mapping")
        if not isinstance(result_mapping, dict):
            raise serializers.ValidationError({"config": "result_mapping обязателен"})
        payload = {"url": str(url), "method": method, "result_mapping": result_mapping}
        if "body_template" in config and config["body_template"] is not None:
            if not isinstance(config["body_template"], dict):
                raise serializers.ValidationError({"config": "body_template должен быть объектом"})
            payload["body_template"] = config["body_template"]
        return payload

    if node_type == "subscenario":
        scenario_id = config.get("scenario_id")
        if not isinstance(scenario_id, int) or scenario_id <= 0:
            raise serializers.ValidationError({"config": "scenario_id: положительное целое"})
        payload = {"scenario_id": scenario_id}
        if config.get("return_node_key"):
            payload["return_node_key"] = str(config["return_node_key"])
        return payload

    if node_type == "delay":
        seconds = config.get("seconds")
        if not isinstance(seconds, int) or seconds < 1 or seconds > 86400:
            raise serializers.ValidationError({"config": "seconds: от 1 до 86400"})
        return {"seconds": seconds}

    raise serializers.ValidationError({"type": f"Неизвестный тип узла: {node_type}"})
