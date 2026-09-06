import pytest
from rest_framework.test import APIClient

from apps.bots.models import BotInstance
from apps.scenarios.models import Node, Scenario
from tests.factories import UserFactory


@pytest.fixture
def auth_client(db):
    user = UserFactory()
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


@pytest.mark.django_db
def test_create_bot_requires_token(auth_client, monkeypatch):
    client, _user = auth_client
    response = client.post("/api/bots/", {"name": "My Bot"}, format="json")
    assert response.status_code == 400
    assert "token" in response.json()


@pytest.mark.django_db
def test_create_bot_validates_token(auth_client, monkeypatch):
    client, _user = auth_client
    monkeypatch.setattr(
        "apps.bots.serializers.verify_telegram_token",
        lambda _token: None,
    )
    response = client.post(
        "/api/bots/",
        {"name": "My Bot", "token": "123:invalid"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_create_bot_success(auth_client, monkeypatch):
    client, user = auth_client
    fake_redis = {}

    class FakeRedis:
        def set(self, key, value):
            fake_redis[key] = value

    monkeypatch.setattr(
        "apps.bots.serializers.verify_telegram_token",
        lambda _token: {"id": 1, "username": "mybot", "first_name": "My Bot"},
    )
    monkeypatch.setattr(
        "apps.bots.services.get_redis_client",
        lambda: FakeRedis(),
    )

    response = client.post(
        "/api/bots/",
        {"token": "123456789:AAHabcdefghijklmnopqrstuvwxyz123456"},
        format="json",
    )
    assert response.status_code == 201, response.json()
    data = response.json()
    assert data["name"] == "My Bot"
    assert data["is_active"] is True

    bot = BotInstance.objects.get(id=data["id"])
    assert bot.owner_id == user.id
    assert bot.default_scenario is not None
    assert Node.objects.filter(scenario__bot=bot, key="start").exists()
    assert fake_redis.get(f"bot:{bot.id}:scenario_version") == "1"
