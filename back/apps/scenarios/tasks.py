import redis
from celery import shared_task
from django.conf import settings

from apps.scenarios.models import Scenario
from apps.scenarios.services.compiler import publish_to_redis


def get_redis_client():
    return redis.from_url(settings.REDIS_URL, decode_responses=True)


@shared_task
def publish_scenario_task(scenario_id: int) -> None:
    scenario = Scenario.objects.select_related("bot").get(pk=scenario_id)
    client = get_redis_client()
    publish_to_redis(scenario, client)
