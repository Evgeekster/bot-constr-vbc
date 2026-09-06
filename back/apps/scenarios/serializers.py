from rest_framework import serializers

from apps.scenarios.models import Node, Scenario, Transition
from apps.scenarios.services.menu_sync import sync_menu_transitions
from apps.scenarios.validators import validate_condition_expr, validate_node_config


class NodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Node
        fields = ("id", "key", "type", "config", "position")
        read_only_fields = ("id",)

    def validate(self, attrs):
        node_type = attrs.get("type") or (self.instance.type if self.instance else None)
        config = attrs.get("config")
        if config is not None and node_type:
            attrs["config"] = validate_node_config(node_type, config)
        return attrs

    def create(self, validated_data):
        node = super().create(validated_data)
        if node.type == "menu":
            sync_menu_transitions(node)
        return node

    def update(self, instance, validated_data):
        node = super().update(instance, validated_data)
        if node.type == "menu":
            sync_menu_transitions(node)
        return node


class TransitionSerializer(serializers.ModelSerializer):
    from_node = serializers.PrimaryKeyRelatedField(read_only=True)
    to_node = serializers.PrimaryKeyRelatedField(queryset=Node.objects.all())

    class Meta:
        model = Transition
        fields = (
            "id",
            "from_node",
            "to_node",
            "trigger",
            "trigger_value",
            "condition_expr",
            "priority",
        )
        read_only_fields = ("id",)

    def validate(self, attrs):
        trigger = attrs.get("trigger") or (self.instance.trigger if self.instance else None)
        condition_expr = attrs.get("condition_expr")
        if condition_expr is None and self.instance:
            condition_expr = self.instance.condition_expr
        if trigger == "condition" and condition_expr:
            validate_condition_expr(condition_expr)
        return attrs


class TransitionCreateSerializer(TransitionSerializer):
    from_node = serializers.PrimaryKeyRelatedField(queryset=Node.objects.all())
    to_node = serializers.PrimaryKeyRelatedField(queryset=Node.objects.all())


class ScenarioSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Scenario
        fields = ("id", "name", "version", "is_published")


class ScenarioDetailSerializer(serializers.ModelSerializer):
    nodes = NodeSerializer(many=True, read_only=True)
    transitions = serializers.SerializerMethodField()

    class Meta:
        model = Scenario
        fields = ("id", "name", "version", "is_published", "nodes", "transitions")

    def get_transitions(self, obj):
        transitions = Transition.objects.filter(from_node__scenario=obj).select_related(
            "from_node", "to_node"
        )
        return TransitionSerializer(transitions, many=True).data


class ScenarioDraftPatchSerializer(serializers.Serializer):
    nodes = NodeSerializer(many=True, required=False)
    transitions = TransitionCreateSerializer(many=True, required=False)
