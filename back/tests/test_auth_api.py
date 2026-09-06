import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


@pytest.mark.django_db
def test_login_and_me(api):
    User.objects.create_user(username="demo", password="demo1234")

    csrf = api.get("/api/auth/csrf/")
    assert csrf.status_code == 200

    bad = api.post("/api/auth/login/", {"username": "demo", "password": "wrong"}, format="json")
    assert bad.status_code == 400

    ok = api.post("/api/auth/login/", {"username": "demo", "password": "demo1234"}, format="json")
    assert ok.status_code == 200
    assert ok.json()["username"] == "demo"

    me = api.get("/api/auth/me/")
    assert me.status_code == 200
    assert me.json()["username"] == "demo"

    logout = api.post("/api/auth/logout/")
    assert logout.status_code == 204

    me_after = api.get("/api/auth/me/")
    assert me_after.status_code == 401


@pytest.mark.django_db
def test_me_unauthenticated(api):
    response = api.get("/api/auth/me/")
    assert response.status_code == 401
