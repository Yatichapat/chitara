from django.db import models


class PrivacyLevel(models.TextChoices):
    PUBLIC = "public", "Public"
    INVITE_ONLY = "invite_only", "Invite Only"
    PRIVATE = "private", "Private"


class GenerationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    IN_PROGRESS = "in_progress", "In Progress"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"
