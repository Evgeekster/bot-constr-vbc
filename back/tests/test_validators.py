import pytest
from rest_framework.exceptions import ValidationError

from apps.scenarios.validators import validate_condition_expr, validate_node_config


def test_validate_message_config():
    result = validate_node_config("message", {"text": "Hello"})
    assert result["text"] == "Hello"


def test_validate_message_config_missing_text():
    with pytest.raises(ValidationError):
        validate_node_config("message", {"text": ""})


def test_validate_question_var_name():
    with pytest.raises(ValidationError):
        validate_node_config("question", {"prompt": "Q?", "var_name": "123bad"})


def test_validate_condition_expr_valid():
    validate_condition_expr("context.var > 0")


def test_validate_condition_expr_invalid():
    with pytest.raises(ValidationError):
        validate_condition_expr("context.var >>>")
