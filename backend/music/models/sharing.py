from django.db import models

from .content_models import Song
from .enums import PrivacyLevel


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


class Invitation(models.Model):
    invitation_id = models.AutoField(primary_key=True)
    link = models.ForeignKey(
        SharedLink,
        on_delete=models.CASCADE,
        related_name="invitations",
    )
    email = models.EmailField()
    sent_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Invitation for {self.email} via link {self.link_id}"
