from django.db import models

from .privacy_level import PrivacyLevel
from .song import Song


class SharedLink(models.Model):
    link_id = models.AutoField(primary_key=True)
    privacy_level = models.CharField(
        max_length=50,
        default=PrivacyLevel.PRIVATE,
        choices=PrivacyLevel.choices,
    )
    expiration_date = models.DateTimeField()
    content = models.ForeignKey(
        Song,
        on_delete=models.CASCADE,
        related_name="shared_links",
    )

    def __str__(self):
        return f"Link for {self.content.title} with {self.privacy_level} privacy"