import base64

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import models


def _get_fernet() -> Fernet:
    key = settings.FERNET_KEY
    if not key:
        key = Fernet.generate_key().decode()
    return Fernet(key.encode() if isinstance(key, str) else key)


class EncryptedCharField(models.CharField):
    """Store values encrypted at rest using Fernet."""

    description = "Encrypted char field"

    def get_prep_value(self, value):
        if value in (None, ""):
            return value
        if isinstance(value, str) and value.startswith("gAAAA"):
            return value
        try:
            f = _get_fernet()
            return f.encrypt(value.encode()).decode()
        except Exception as exc:
            raise ImproperlyConfigured("Invalid FERNET_KEY for token encryption") from exc

    def from_db_value(self, value, expression, connection):
        return self.to_python(value)

    def to_python(self, value):
        if value in (None, ""):
            return value
        try:
            f = _get_fernet()
            return f.decrypt(value.encode()).decode()
        except InvalidToken:
            return value
