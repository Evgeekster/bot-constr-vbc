from django.urls import path

from apps.scenarios.views import (
    BotScenarioListView,
    NodeDetailView,
    ScenarioDetailView,
    ScenarioNodeCreateView,
    ScenarioPublishView,
    ScenarioTransitionCreateView,
    TransitionCreateView,
    TransitionDetailView,
)

urlpatterns = [
    path("bots/<int:bot_id>/scenarios/", BotScenarioListView.as_view(), name="bot-scenarios"),
    path("scenarios/<int:scenario_id>/", ScenarioDetailView.as_view(), name="scenario-detail"),
    path(
        "scenarios/<int:scenario_id>/publish/",
        ScenarioPublishView.as_view(),
        name="scenario-publish",
    ),
    path(
        "scenarios/<int:scenario_id>/nodes/",
        ScenarioNodeCreateView.as_view(),
        name="scenario-node-create",
    ),
    path("scenarios/<int:scenario_id>/transitions/", ScenarioTransitionCreateView.as_view(), name="scenario-transition-create"),
    path("nodes/<int:node_id>/", NodeDetailView.as_view(), name="node-detail"),
    path("transitions/", TransitionCreateView.as_view(), name="transition-create"),
    path(
        "transitions/<int:transition_id>/",
        TransitionDetailView.as_view(),
        name="transition-detail",
    ),
]
