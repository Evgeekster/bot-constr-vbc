from django.urls import path

from apps.bots.auth_views import CsrfCookieView, LoginView, LogoutView, MeView
from apps.bots.views import BotListCreateView, BotDetailView

urlpatterns = [
    path("auth/csrf/", CsrfCookieView.as_view(), name="auth-csrf"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("bots/", BotListCreateView.as_view(), name="bot-list"),
    path("bots/<int:pk>/", BotDetailView.as_view(), name="bot-detail"),
]
