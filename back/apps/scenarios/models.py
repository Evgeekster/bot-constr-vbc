from django.db import models


NODE_TYPES = [
    "message",
    "question",
    "menu",
    "condition",
    "action",
    "subscenario",
    "delay",
]

TRIGGERS = ["callback", "text", "condition", "always"]


class Scenario(models.Model):
    bot = models.ForeignKey(
        "bots.BotInstance",
        related_name="scenarios",
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=255)
    version = models.PositiveIntegerField(default=1)
    is_published = models.BooleanField(default=False)
    cloned_from = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="drafts",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return f"{self.name} v{self.version}"


class Node(models.Model):
    scenario = models.ForeignKey(Scenario, related_name="nodes", on_delete=models.CASCADE)
    key = models.SlugField(max_length=64)
    type = models.CharField(max_length=32, choices=[(t, t) for t in NODE_TYPES])
    config = models.JSONField(default=dict)
    position = models.JSONField(default=dict)

    class Meta:
        unique_together = [("scenario", "key")]
        ordering = ["id"]

    def __str__(self) -> str:
        return f"{self.key} ({self.type})"


class Transition(models.Model):
    from_node = models.ForeignKey(
        Node, related_name="transitions_out", on_delete=models.CASCADE
    )
    to_node = models.ForeignKey(
        Node, related_name="transitions_in", on_delete=models.CASCADE
    )
    trigger = models.CharField(max_length=16, choices=[(t, t) for t in TRIGGERS])
    trigger_value = models.CharField(max_length=255, null=True, blank=True)
    condition_expr = models.CharField(max_length=500, null=True, blank=True)
    priority = models.IntegerField(default=0)

    class Meta:
        ordering = ["priority", "id"]

    def __str__(self) -> str:
        return f"{self.from_node.key} -> {self.to_node.key} ({self.trigger})"


class UserSessionLog(models.Model):
    bot = models.ForeignKey("bots.BotInstance", on_delete=models.CASCADE)
    telegram_user_id = models.BigIntegerField()
    node = models.ForeignKey(Node, on_delete=models.SET_NULL, null=True, blank=True)
    context_snapshot = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["bot", "telegram_user_id", "created_at"]),
        ]
