import pytest
from django.core.management import call_command

from apps.bots.models import BotInstance
from apps.scenarios.models import Node, Scenario


@pytest.mark.django_db
def test_seed_demo_creates_graph():
    call_command("seed_demo")
    assert BotInstance.objects.filter(name="Demo Bot").exists()
    scenario = Scenario.objects.get(name="Welcome flow")
    assert Node.objects.filter(scenario=scenario, key="start").exists()
    assert Node.objects.filter(scenario=scenario, key="main_menu").exists()


@pytest.mark.django_db
def test_seed_demo_idempotent():
    call_command("seed_demo")
    call_command("seed_demo")
    assert BotInstance.objects.filter(name="Demo Bot").count() == 1
