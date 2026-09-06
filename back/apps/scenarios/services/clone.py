from django.db import transaction

from apps.scenarios.models import Node, Scenario, Transition


@transaction.atomic
def clone_scenario_as_draft(scenario: Scenario) -> Scenario:
    """Clone a published scenario into a new unpublished draft."""
    draft = Scenario.objects.create(
        bot=scenario.bot,
        name=scenario.name,
        version=scenario.version,
        is_published=False,
        cloned_from=scenario,
    )

    node_map: dict[int, Node] = {}
    for node in scenario.nodes.all():
        new_node = Node.objects.create(
            scenario=draft,
            key=node.key,
            type=node.type,
            config=node.config,
            position=node.position,
        )
        node_map[node.id] = new_node

    for transition in Transition.objects.filter(from_node__scenario=scenario):
        Transition.objects.create(
            from_node=node_map[transition.from_node_id],
            to_node=node_map[transition.to_node_id],
            trigger=transition.trigger,
            trigger_value=transition.trigger_value,
            condition_expr=transition.condition_expr,
            priority=transition.priority,
        )

    return draft
