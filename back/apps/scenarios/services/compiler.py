import json

from apps.scenarios.models import Node, Scenario, Transition


def compile_scenario_snapshot(scenario: Scenario) -> dict:
    """Compile scenario ORM graph into runner snapshot format."""
    nodes = Node.objects.filter(scenario=scenario)
    transitions = Transition.objects.filter(from_node__scenario=scenario).select_related(
        "from_node", "to_node"
    )

    nodes_map = {}
    for node in nodes:
        nodes_map[node.key] = {
            "type": node.type,
            "config": node.config,
        }

    transitions_map: dict[str, list] = {}
    for t in transitions.order_by("priority", "id"):
        from_key = t.from_node.key
        transitions_map.setdefault(from_key, []).append({
            "trigger": t.trigger,
            "value": t.trigger_value,
            "to": t.to_node.key,
            "priority": t.priority,
            "condition_expr": t.condition_expr,
        })

    return {
        "nodes": nodes_map,
        "transitions": transitions_map,
        "scenario_id": scenario.id,
        "version": scenario.version,
    }


def publish_to_redis(scenario: Scenario, redis_client) -> None:
    """Write compiled snapshot to Redis."""
    snapshot = compile_scenario_snapshot(scenario)
    bot_id = scenario.bot_id
    version = scenario.version
    key = f"scenario:{bot_id}:{version}"
    redis_client.set(key, json.dumps(snapshot, ensure_ascii=False))
    redis_client.set(f"bot:{bot_id}:scenario_version", str(version))
