from django.db import models

from .privacy_level import PrivacyLevel
from .shareable_content import ShareableContent
from .users import EndUser


class Album(ShareableContent):
    album_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    created_date = models.DateTimeField(auto_now_add=True)
    privacy_level = models.CharField(
        max_length=50,
        choices=PrivacyLevel.choices,
        default=PrivacyLevel.PRIVATE,
    )
    invited_emails = models.JSONField(default=list, blank=True)

    creator = models.ForeignKey(
        EndUser,
        on_delete=models.CASCADE,
        related_name="albums",
    )

    def __str__(self):
        return self.name