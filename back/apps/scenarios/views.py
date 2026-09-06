from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied

from apps.bots.models import BotInstance
from apps.bots.permissions import IsBotOwner
from apps.scenarios.models import Node, Scenario, Transition
from apps.scenarios.serializers import (
    NodeSerializer,
    ScenarioDetailSerializer,
    ScenarioSummarySerializer,
    TransitionCreateSerializer,
    TransitionSerializer,
)
from apps.scenarios.services.clone import clone_scenario_as_draft
from apps.scenarios.services.graph_validation import validate_scenario_graph
from apps.scenarios.services.menu_sync import sync_menu_transitions
from apps.scenarios.tasks import publish_scenario_task


class BotScenarioListView(generics.ListCreateAPIView):
    """List scenarios for a bot, and allow creating a new scenario for the bot."""
    serializer_class = ScenarioSummarySerializer
    permission_classes = [IsBotOwner]

    def get_queryset(self):
        bot = get_object_or_404(
            BotInstance, pk=self.kwargs["bot_id"], owner=self.request.user
        )
        return Scenario.objects.filter(bot=bot)

    def create(self, request, *args, **kwargs):
        bot = get_object_or_404(
            BotInstance, pk=self.kwargs["bot_id"], owner=self.request.user
        )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        scenario = serializer.save(bot=bot)
        return Response(self.get_serializer(scenario).data, status=status.HTTP_201_CREATED)


class ScenarioDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsBotOwner]
    lookup_url_kwarg = "scenario_id"

    def get_queryset(self):
        return Scenario.objects.filter(bot__owner=self.request.user)

    def get_serializer_class(self):
        return ScenarioDetailSerializer

    @transaction.atomic
    def patch(self, request, *args, **kwargs):
        scenario = self.get_object()
        if scenario.is_published:
            scenario = clone_scenario_as_draft(scenario)

        nodes_data = request.data.get("nodes")
        transitions_data = request.data.get("transitions")

        if nodes_data is not None:
            self._bulk_upsert_nodes(scenario, nodes_data)
        if transitions_data is not None:
            self._bulk_upsert_transitions(scenario, transitions_data)

        scenario.refresh_from_db()
        serializer = ScenarioDetailSerializer(scenario)
        return Response(serializer.data)

    def _bulk_upsert_nodes(self, scenario: Scenario, nodes_data: list) -> None:
        """Upsert nodes for a scenario.

        Behavior:
        - If an item provides an id that matches an existing node -> update that node.
        - Else if an item provides a key that matches an existing node -> update that node.
        - Else -> create a new node for the scenario.

        This prevents attempting to create a new Node with a key that already exists on the
        scenario and causing a unique constraint violation.
        """
        existing_by_id = {n.id: n for n in scenario.nodes.all()}
        existing_by_key = {n.key: n for n in scenario.nodes.all()}
        seen_ids: set[int] = set()

        for item in nodes_data:
            node_id = item.get("id")
            node_key = item.get("key")

            # Prefer explicit id match
            instance = None
            if node_id and node_id in existing_by_id:
                instance = existing_by_id[node_id]
            # Otherwise, if key matches an existing node, update that one
            elif node_key and node_key in existing_by_key:
                instance = existing_by_key[node_key]

            serializer = NodeSerializer(instance=instance, data=item, partial=bool(instance))
            serializer.is_valid(raise_exception=True)

            if instance:
                node = serializer.save()
            else:
                node = serializer.save(scenario=scenario)

            # Track which existing nodes we've seen/updated so we can delete removed ones
            seen_ids.add(node.id)

        # Delete nodes that weren't present in the payload
        for node_id, node in existing_by_id.items():
            if node_id not in seen_ids:
                node.delete()

    def _bulk_upsert_transitions(self, scenario: Scenario, transitions_data: list) -> None:
        scenario_node_ids = set(scenario.nodes.values_list("id", flat=True))
        existing = {
            t.id: t
            for t in Transition.objects.filter(from_node__scenario=scenario)
        }
        seen_ids: set[int] = set()

        for item in transitions_data:
            trans_id = item.get("id")
            from_node_id = item.get("from_node")
            to_node_id = item.get("to_node")
            if from_node_id not in scenario_node_ids or to_node_id not in scenario_node_ids:
                continue

            instance = existing.get(trans_id) if trans_id else None
            serializer = TransitionCreateSerializer(
                instance=instance,
                data=item,
                partial=bool(trans_id),
            )
            serializer.is_valid(raise_exception=True)
            transition = serializer.save()
            seen_ids.add(transition.id)

        for trans_id, transition in existing.items():
            if trans_id not in seen_ids:
                transition.delete()


class ScenarioPublishView(APIView):
    permission_classes = [IsBotOwner]

    def post(self, request, scenario_id: int):
        scenario = get_object_or_404(
            Scenario, pk=scenario_id, bot__owner=request.user
        )
        nodes = list(scenario.nodes.all())
        transitions = list(
            Transition.objects.filter(from_node__scenario=scenario)
        )
        issues = validate_scenario_graph(nodes, transitions)
        errors = [i for i in issues if i["type"] == "error"]
        if errors:
            return Response(
                {"detail": "Ошибки валидации графа", "issues": issues},
                status=status.HTTP_400_BAD_REQUEST,
            )

        scenario.version += 1
        scenario.is_published = True
        scenario.save(update_fields=["version", "is_published", "updated_at"])

        publish_scenario_task.delay(scenario.id)

        warnings = [i for i in issues if i["type"] == "warning"]
        serializer = ScenarioDetailSerializer(scenario)
        data = serializer.data
        if warnings:
            data["warnings"] = warnings
        return Response(data)


class ScenarioNodeCreateView(generics.CreateAPIView):
    serializer_class = NodeSerializer
    permission_classes = [IsBotOwner]

    @transaction.atomic
    def perform_create(self, serializer):
        scenario = get_object_or_404(
            Scenario,
            pk=self.kwargs["scenario_id"],
            bot__owner=self.request.user,
        )
        if scenario.is_published:
            scenario = clone_scenario_as_draft(scenario)
        node = serializer.save(scenario=scenario)
        if node.type == "menu":
            sync_menu_transitions(node)


class NodeDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = NodeSerializer
    permission_classes = [IsBotOwner]
    lookup_url_kwarg = "node_id"

    def get_queryset(self):
        return Node.objects.filter(scenario__bot__owner=self.request.user)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        node = self.get_object()
        if node.scenario.is_published:
            draft = clone_scenario_as_draft(node.scenario)
            node = draft.nodes.get(key=node.key)
            self.kwargs["node_id"] = node.pk
        return super().update(request, *args, **kwargs)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        node = self.get_object()
        if node.scenario.is_published:
            draft = clone_scenario_as_draft(node.scenario)
            node = draft.nodes.get(key=node.key)
            self.kwargs["node_id"] = node.pk
        return super().destroy(request, *args, **kwargs)


class TransitionCreateView(generics.CreateAPIView):
    serializer_class = TransitionCreateSerializer
    permission_classes = [IsBotOwner]

    def perform_create(self, serializer):
        from_node = serializer.validated_data["from_node"]
        if from_node.scenario.bot.owner_id != self.request.user.id:
            raise PermissionDenied("You do not have permission to create transitions for this bot")
        if from_node.scenario.is_published:
            draft = clone_scenario_as_draft(from_node.scenario)
            key = from_node.key
            from_node = draft.nodes.get(key=key)
            to_key = serializer.validated_data["to_node"].key
            to_node = draft.nodes.get(key=to_key)
            serializer.save(from_node=from_node, to_node=to_node)
        else:
            serializer.save()


class ScenarioTransitionCreateView(generics.CreateAPIView):
    """Create a transition scoped to a scenario via /api/scenarios/<scenario_id>/transitions/ """
    serializer_class = TransitionCreateSerializer
    permission_classes = [IsBotOwner]

    def perform_create(self, serializer):
        scenario = get_object_or_404(
            Scenario, pk=self.kwargs["scenario_id"], bot__owner=self.request.user
        )

        # Ensure provided nodes belong to the scenario
        from_node = serializer.validated_data.get("from_node")
        to_node = serializer.validated_data.get("to_node")

        # Validate ownership and scenario membership
        if from_node is None or to_node is None:
            # Let serializer raise normally on missing fields
            serializer.is_valid(raise_exception=True)

        if from_node.scenario_id != scenario.id or to_node.scenario_id != scenario.id:
            raise PermissionDenied("from_node and to_node must belong to the specified scenario")

        # If scenario is published, create/update on a draft copy
        if scenario.is_published:
            draft = clone_scenario_as_draft(scenario)
            from_key = from_node.key
            from_node = draft.nodes.get(key=from_key)
            to_key = to_node.key
            to_node = draft.nodes.get(key=to_key)
            serializer.save(from_node=from_node, to_node=to_node)
        else:
            serializer.save()


class TransitionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsBotOwner]
    lookup_url_kwarg = "transition_id"

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return TransitionSerializer
        return TransitionSerializer

    def get_queryset(self):
        return Transition.objects.filter(from_node__scenario__bot__owner=self.request.user)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        transition = self.get_object()
        if transition.from_node.scenario.is_published:
            draft = clone_scenario_as_draft(transition.from_node.scenario)
            transition = Transition.objects.get(
                from_node__scenario=draft,
                from_node__key=transition.from_node.key,
                trigger=transition.trigger,
                trigger_value=transition.trigger_value,
            )
            self.kwargs["transition_id"] = transition.pk
        return super().update(request, *args, **kwargs)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        transition = self.get_object()
        if transition.from_node.scenario.is_published:
            draft = clone_scenario_as_draft(transition.from_node.scenario)
            transition = Transition.objects.get(
                from_node__scenario=draft,
                from_node__key=transition.from_node.key,
                trigger=transition.trigger,
                trigger_value=transition.trigger_value,
            )
            self.kwargs["transition_id"] = transition.pk
        return super().destroy(request, *args, **kwargs)
