from django.db import models


class PrivacyLevel(models.TextChoices):
    PUBLIC = "public", "Public"
    INVITE_ONLY = "invite_only", "Invite Only"
    PRIVATE = "private", "Private"