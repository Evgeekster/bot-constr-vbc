import pytest

from tests.factories import NodeFactory, TransitionFactory


@pytest.mark.django_db
def test_bot_list(api_client, bot):
    response = api_client.get("/api/bots/")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["name"] == bot.name


@pytest.mark.django_db
def test_create_node(api_client, scenario):
    response = api_client.post(
        f"/api/scenarios/{scenario.id}/nodes/",
        {"key": "start", "type": "message", "config": {"text": "Hello"}, "position": {"x": 0, "y": 0}},
        format="json",
    )
    assert response.status_code == 201
    assert response.json()["key"] == "start"


@pytest.mark.django_db
def test_menu_syncs_callback_transitions(api_client, scenario):
    menu = NodeFactory(
        scenario=scenario,
        key="menu1",
        type="menu",
        config={
            "text": "Choose",
            "buttons": [
                {"text": "A", "callback": "a"},
                {"text": "B", "callback": "b"},
            ],
        },
    )
    from apps.scenarios.services.menu_sync import sync_menu_transitions

    sync_menu_transitions(menu)
    callbacks = set(
        menu.transitions_out.filter(trigger="callback").values_list("trigger_value", flat=True)
    )
    assert callbacks == {"a", "b"}


@pytest.mark.django_db
def test_publish_validates_missing_start(api_client, scenario):
    NodeFactory(scenario=scenario, key="other", type="message", config={"text": "x"})
    response = api_client.post(f"/api/scenarios/{scenario.id}/publish/")
    assert response.status_code == 400
    assert "start" in response.json()["detail"].lower() or any(
        "start" in i["message"].lower() for i in response.json()["issues"]
    )


@pytest.mark.django_db
def test_publish_success(api_client, scenario, monkeypatch):
    import fakeredis

    fake = fakeredis.FakeRedis(decode_responses=True)

    def mock_get_redis():
        return fake

    monkeypatch.setattr("apps.scenarios.tasks.get_redis_client", mock_get_redis)

    start = NodeFactory(scenario=scenario, key="start", type="message", config={"text": "Hi"})
    nxt = NodeFactory(scenario=scenario, key="next", type="message", config={"text": "Bye"})
    TransitionFactory(from_node=start, to_node=nxt, trigger="always")

    response = api_client.post(f"/api/scenarios/{scenario.id}/publish/")
    assert response.status_code == 200
    assert response.json()["is_published"] is True
    assert response.json()["version"] == 2
    assert fake.get("bot:1:scenario_version") == "2" or fake.get(f"bot:{scenario.bot_id}:scenario_version") == "2"


@pytest.mark.django_db
def test_patch_published_clones(api_client, published_scenario):
    response = api_client.patch(
        f"/api/scenarios/{published_scenario.id}/",
        {},
        format="json",
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] != published_scenario.id
    assert data["is_published"] is False
