from django.contrib import admin

from apps.bots.models import BotInstance


@admin.register(BotInstance)
class BotInstanceAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "owner", "is_active", "webhook_mode", "created_at")
    list_filter = ("is_active", "webhook_mode")
    search_fields = ("name",)
