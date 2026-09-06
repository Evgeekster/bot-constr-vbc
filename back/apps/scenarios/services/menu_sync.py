from django.db import transaction

from apps.scenarios.models import Node, Transition


def sync_menu_transitions(node: Node) -> None:
    """Create/delete callback transitions to match menu button list."""
    if node.type != "menu":
        return

    buttons = node.config.get("buttons", [])
    callbacks = {btn["callback"] for btn in buttons}

    existing = Transition.objects.filter(from_node=node, trigger="callback")
    existing_by_value = {t.trigger_value: t for t in existing}

    for callback in callbacks - existing_by_value.keys():
        target = (
            Transition.objects.filter(from_node=node)
            .exclude(trigger="callback", trigger_value__in=callbacks)
            .first()
        )
        to_node = target.to_node if target else node
        Transition.objects.create(
            from_node=node,
            to_node=to_node,
            trigger="callback",
            trigger_value=callback,
            priority=0,
        )

    Transition.objects.filter(from_node=node, trigger="callback").exclude(
        trigger_value__in=callbacks
    ).delete()
