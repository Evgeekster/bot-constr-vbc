from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsBotOwner(BasePermission):
    """Allow access only to bots owned by the authenticated user."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        bot = getattr(obj, "bot", None) or obj
        if hasattr(bot, "owner_id"):
            return bot.owner_id == request.user.id
        if hasattr(obj, "scenario"):
            return obj.scenario.bot.owner_id == request.user.id
        if hasattr(obj, "from_node"):
            return obj.from_node.scenario.bot.owner_id == request.user.id
        return False
