from rest_framework import serializers

from apps.bots.models import BotInstance
from apps.bots.services import bootstrap_new_bot, verify_telegram_token


class BotSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotInstance
        fields = ("id", "name", "is_active")


class BotCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    token = serializers.CharField(write_only=True, trim_whitespace=True)
    is_active = serializers.BooleanField(default=True, required=False)

    def validate_token(self, value: str) -> str:
        info = verify_telegram_token(value)
        if info is None:
            raise serializers.ValidationError(
                "Недействительный Telegram bot token. Проверьте токен у @BotFather."
            )
        self.context["telegram_bot_info"] = info
        return value

    def create(self, validated_data) -> BotInstance:
        request = self.context["request"]
        info = self.context.get("telegram_bot_info", {})
        name = (validated_data.get("name") or "").strip()
        if not name:
            name = info.get("first_name") or info.get("username") or "Telegram Bot"

        try:
            return bootstrap_new_bot(
                owner=request.user,
                name=name,
                token=validated_data["token"],
                is_active=validated_data.get("is_active", True),
            )
        except RuntimeError as exc:
            raise serializers.ValidationError({"detail": str(exc)}) from exc
