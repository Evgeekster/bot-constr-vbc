import factory
from django.contrib.auth import get_user_model
from factory.django import DjangoModelFactory

from apps.bots.models import BotInstance
from apps.scenarios.models import Node, Scenario, Transition

User = get_user_model()


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"user{n}")
    password = factory.PostGenerationMethodCall("set_password", "password123")


class BotInstanceFactory(DjangoModelFactory):
    class Meta:
        model = BotInstance

    owner = factory.SubFactory(UserFactory)
    name = factory.Sequence(lambda n: f"Bot {n}")
    token = factory.Sequence(lambda n: f"token-{n}")
    is_active = True


class ScenarioFactory(DjangoModelFactory):
    class Meta:
        model = Scenario

    bot = factory.SubFactory(BotInstanceFactory)
    name = "Main scenario"
    version = 1
    is_published = False


class NodeFactory(DjangoModelFactory):
    class Meta:
        model = Node

    scenario = factory.SubFactory(ScenarioFactory)
    key = factory.Sequence(lambda n: f"node_{n}")
    type = "message"
    config = factory.LazyFunction(lambda: {"text": "Hello"})
    position = factory.LazyFunction(lambda: {"x": 0, "y": 0})


class TransitionFactory(DjangoModelFactory):
    class Meta:
        model = Transition

    from_node = factory.SubFactory(NodeFactory)
    to_node = factory.SubFactory(NodeFactory, scenario=factory.SelfAttribute("..from_node.scenario"))
    trigger = "always"
    priority = 0
