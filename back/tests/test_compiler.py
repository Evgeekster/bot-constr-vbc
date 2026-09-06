import pytest

from apps.scenarios.services.compiler import compile_scenario_snapshot
from apps.scenarios.services.graph_validation import validate_scenario_graph
from tests.factories import NodeFactory, ScenarioFactory, TransitionFactory


@pytest.mark.django_db
def test_compile_snapshot_format():
    scenario = ScenarioFactory()
    start = NodeFactory(scenario=scenario, key="start", type="message", config={"text": "Hi"})
    nxt = NodeFactory(scenario=scenario, key="next", type="message", config={"text": "Bye"})
    TransitionFactory(from_node=start, to_node=nxt, trigger="always")

    snapshot = compile_scenario_snapshot(scenario)
    assert "start" in snapshot["nodes"]
    assert snapshot["nodes"]["start"]["type"] == "message"
    assert snapshot["transitions"]["start"][0]["to"] == "next"


@pytest.mark.django_db
def test_graph_validation_requires_start():
    scenario = ScenarioFactory()
    NodeFactory(scenario=scenario, key="other", type="message", config={"text": "x"})
    issues = validate_scenario_graph(scenario.nodes.all(), [])
    assert any(i["type"] == "error" for i in issues)
