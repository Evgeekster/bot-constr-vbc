from django.contrib import admin

from apps.scenarios.models import Node, Scenario, Transition, UserSessionLog


class NodeInline(admin.TabularInline):
    model = Node
    extra = 0


@admin.register(Scenario)
class ScenarioAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "bot", "version", "is_published", "updated_at")
    list_filter = ("is_published",)
    inlines = [NodeInline]


@admin.register(Transition)
class TransitionAdmin(admin.ModelAdmin):
    list_display = ("id", "from_node", "to_node", "trigger", "trigger_value", "priority")


@admin.register(UserSessionLog)
class UserSessionLogAdmin(admin.ModelAdmin):
    list_display = ("id", "bot", "telegram_user_id", "node", "created_at")
    list_filter = ("bot",)
