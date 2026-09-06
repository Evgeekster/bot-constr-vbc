import os

os.environ.setdefault("USE_SQLITE", "1")
os.environ.setdefault("CELERY_TASK_ALWAYS_EAGER", "1")

import pytest
from rest_framework.test import APIClient

from tests.factories import BotInstanceFactory, NodeFactory, ScenarioFactory, TransitionFactory, UserFactory

pytest_plugins = ["tests.factories"]


@pytest.fixture(autouse=True)
def _celery_eager(settings):
    settings.CELERY_TASK_ALWAYS_EAGER = True


@pytest.fixture
def user(db):
    return UserFactory()


@pytest.fixture
def api_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def bot(user):
    return BotInstanceFactory(owner=user)


@pytest.fixture
def scenario(bot):
    return ScenarioFactory(bot=bot)


@pytest.fixture
def published_scenario(bot):
    scenario = ScenarioFactory(bot=bot, is_published=True, version=2)
    start = NodeFactory(scenario=scenario, key="start", type="message", config={"text": "Hi"})
    next_node = NodeFactory(scenario=scenario, key="next", type="message", config={"text": "Bye"})
    TransitionFactory(from_node=start, to_node=next_node, trigger="always")
    return scenario
