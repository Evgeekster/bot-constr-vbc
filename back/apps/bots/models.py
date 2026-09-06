from django.conf import settings
from django.db import models

from apps.bots.fields import EncryptedCharField


class BotInstance(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="bots",
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=255)
    token = EncryptedCharField(max_length=512)
    is_active = models.BooleanField(default=False)
    webhook_mode = models.BooleanField(default=False)
    default_scenario = models.ForeignKey(
        "scenarios.Scenario",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name
