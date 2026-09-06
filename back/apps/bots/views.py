from rest_framework import generics, status
from rest_framework.response import Response

from apps.bots.models import BotInstance
from apps.bots.permissions import IsBotOwner
from apps.bots.serializers import BotCreateSerializer, BotSerializer


class BotListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsBotOwner]

    def get_queryset(self):
        return BotInstance.objects.filter(owner=self.request.user)

    def get_serializer_class(self):
        if self.request.method == "POST":
            return BotCreateSerializer
        return BotSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        bot = serializer.save()
        return Response(BotSerializer(bot).data, status=status.HTTP_201_CREATED)


class BotDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete a single bot instance owned by the user."""
    permission_classes = [IsBotOwner]
    serializer_class = BotSerializer

    def get_queryset(self):
        return BotInstance.objects.filter(owner=self.request.user)
