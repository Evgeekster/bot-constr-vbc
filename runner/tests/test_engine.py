import json

import pytest

from runner.action_executor import execute_action, substitute_templates
from runner.engine import ScenarioEngine
from runner.storage import ScenarioStorage


@pytest.fixture
def redis_url():
    return "redis://localhost:6379/15"


@pytest.fixture
async def fake_redis(redis_url):
    import fakeredis.aioredis

    server = fakeredis.aioredis.FakeRedis(decode_responses=True)
    storage = ScenarioStorage.__new__(ScenarioStorage)
    storage.bot_id = 1
    storage._redis = server
    yield storage, server
    await server.aclose()


@pytest.fixture
def sample_snapshot():
    return {
        "nodes": {
            "start": {"type": "message", "config": {"text": "Welcome"}},
            "ask": {"type": "question", "config": {"prompt": "Name?", "var_name": "name"}},
            "done": {"type": "message", "config": {"text": "Thanks"}},
        },
        "transitions": {
            "start": [{"trigger": "always", "value": None, "to": "ask", "priority": 0}],
            "ask": [{"trigger": "always", "value": None, "to": "done", "priority": 0}],
        },
    }


@pytest.mark.asyncio
async def test_engine_start(fake_redis, sample_snapshot):
    storage, redis = fake_redis
    await redis.set("bot:1:scenario_version", "1")
    await redis.set(f"scenario:1:1", json.dumps(sample_snapshot))

    engine = ScenarioEngine(storage)
    output = await engine.start(user_id=42)

    assert len(output.messages) >= 1
    assert output.messages[0]["text"] == "Welcome"
    assert output.question is not None
    assert output.question["prompt"] == "Name?"


@pytest.mark.asyncio
async def test_engine_handle_text(fake_redis, sample_snapshot):
    storage, redis = fake_redis
    await redis.set("bot:1:scenario_version", "1")
    await redis.set(f"scenario:1:1", json.dumps(sample_snapshot))
    await redis.set(
        "session:1:42",
        json.dumps({"current_node": "ask", "vars": {}}),
    )

    engine = ScenarioEngine(storage)
    output = await engine.handle_text(42, "Alice")

    assert any(m["text"] == "Thanks" for m in output.messages)
    ctx = json.loads(await redis.get("session:1:42"))
    assert ctx["vars"]["name"] == "Alice"


def test_substitute_templates():
    result = substitute_templates(
        {"name": "{{context.user}}", "nested": ["{{context.id}}"]},
        {"user": "Bob", "id": "1"},
    )
    assert result["name"] == "Bob"
    assert result["nested"] == ["1"]
